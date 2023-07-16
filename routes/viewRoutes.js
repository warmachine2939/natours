const express = require('express');

const viewsController = require('../controllers/viewsController');
const authcontroller = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.get('/', bookingController.createBookingCheckout, authcontroller.isLoggedIn, viewsController.getOverview);

router.get('/tour/:slug', authcontroller.isLoggedIn, viewsController.getTour);

router.get('/login', authcontroller.isLoggedIn, viewsController.getLoginForm);

router.get('/signup', viewsController.getSignupForm);

router.get('/me', authcontroller.protect, viewsController.getAccount);
router.get('/my-tours', authcontroller.protect, viewsController.getMyTours);
router.get('/my-reviews', authcontroller.isLoggedIn, viewsController.getMyReviews);
router.post('/submit-user-data', authcontroller.protect, viewsController.updateUserData);

module.exports = router;
