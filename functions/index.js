const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Live-mode price id (test mode had its own, separate id).
const PRICE_ID = "price_1UHfoYLsdqYc3ZFMkrwPiQQl";

const SUCCESS_URL = "https://jobhuntxpert.com/app.html?checkout=success";
const CANCEL_URL = "https://jobhuntxpert.com/app.html?checkout=cancelled";

// Callable from the signed-in app: creates a Stripe Checkout Session for the
// one-time €39.99 lifetime purchase and hands back the URL to redirect to.
exports.createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to purchase.");
  }

  const stripe = new Stripe(stripeSecretKey.value());
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // A digital, non-taxable one-time product — Managed Payments (Stripe Tax) isn't
    // needed here and requires a product tax code we don't have, so skip it.
    managed_payments: { enabled: false },
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    // Lets a customer enter a promotion code (e.g. the early-adopter discount) at checkout.
    allow_promotion_codes: true,
    // Trusted server-side value from the verified auth token — never taken from client input,
    // so it can't be forged to unlock a different account.
    client_reference_id: request.auth.uid,
    customer_email: request.auth.token.email || undefined,
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
  });

  return { url: session.url };
});

// Stripe calls this directly (not through the app) once a payment completes.
// This is the ONLY place that ever writes `paid: true` — client writes to that
// field are already rejected by firestore.rules, so this webhook, verified by
// Stripe's signature, is the sole source of truth for a real payment.
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = new Stripe(stripeSecretKey.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], stripeWebhookSecret.value());
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid" && session.client_reference_id) {
      const uid = session.client_reference_id;
      await admin.firestore().doc(`users/${uid}`).set(
        {
          paid: true,
          paidAt: Date.now(),
          stripeCustomerId: session.customer || null,
          stripeSessionId: session.id,
        },
        { merge: true }
      );
    }
  }

  // Idempotent by design: a duplicate webhook retry just rewrites the same values.
  res.status(200).send();
});
