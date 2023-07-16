const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Review = require('../models/reviewModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getOverview = catchAsync(async (req, res, next) => {
  //1) Get TOur data from the collection
  const tours = await Tour.find();
  //2) Build template

  //3) Rendaer that template using tour data
  res.status(200).set('Content-Security-Policy', "connect-src 'self' https://cdnjs.cloudflare.com").render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  //1) Get the data, for the requested tour along with the guides and the reviews

  const tour = await Tour.findOne({
    slug: req.params.slug,
  }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });
  //2) build template
  //3) Render the template using data
  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }
  const booking = await Booking.findOne({
    user: res.locals.user,
    tour: tour,
  });

  let commentExist;
  if (res.locals.user) {
    commentExist = tour.reviews.some((review) => review.user.id === res.locals.user.id);
  }

  const booked = !!booking;
  res
    .status(200)
    .set('Content-Security-Policy', "connect-src 'self' https://cdnjs.cloudflare.com")
    .render('tour', {
      title: `${tour.name} tour`,
      tour,
      booked,
      commentExist,
    });
});
exports.getLoginForm = (req, res) => {
  res.status(200).set('Content-Security-Policy', "connect-src 'self' https://cdnjs.cloudflare.com").render('login', {
    title: 'Log into your account',
  });
};
exports.getSignupForm = (req, res) => {
  res.status(200).set('Content-Security-Policy', "connect-src 'self' https://cdnjs.cloudflare.com").render('signup', {
    title: 'Create a new account',
  });
};
exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Your Account',
  });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  //1) Find all bookings
  const bookings = await Booking.find({
    user: req.user.id,
  });
  //2) Find tours with the returned IDs
  const tourIds = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIds } });

  res.status(200).render('overview', {
    title: 'My tours',
    tours,
  });
});

exports.getMyReviews = catchAsync(async (req, res, next) => {
  // 1) Get reviews of the currently logged in user

  const reviews = await Review.find({
    user: res.locals.user.id,
  }).populate({
    path: 'tour',
    select: 'name slug',
  });

  res.status(200).render('reviews', {
    title: 'My reviews',
    reviews,
    toursNames: true,
  });
});

exports.updateUserData = catchAsync(async (req, res, next) => {
  console.log(req.params);
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  res.status(200).render('account', {
    title: 'Your Account',
    user: updatedUser,
  });
});
