import { showAlert } from './alerts';

/*eslint-disable*/
const stripe = Stripe(
  'pk_test_51NSSWuSATxeCRZhs12oftZCZ0Vp3oBnE9URxKECGqTVCrwAtENHrEzM2x4fCuRlwz7dxECRRmCZYnGKA1Ydy82Ev00n8cEr4jt'
);
export const bookTour = async (tourId, startDateId) => {
  try {
    // 1) Get checkout session from API
    console.log('working');
    const session = await axios(
      `/api/v1/booking/checkout-session/${tourId}/${startDateId}`
    );
    console.log(session.data.session.id, session);
    // 2) Create checkout form + charge the credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
