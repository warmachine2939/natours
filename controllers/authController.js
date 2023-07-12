const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() +
        process.env.JWT_COOKIE_EXPIRES_IN *
          24 *
          60 *
          60 *
          1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production')
    cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token: token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    photo: req.body.photo,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });
  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1) Check if email and passwrong exists
  if (!email || !password) {
    return next(
      new AppError(
        'Please enter a valid email and password',
        400
      )
    );
  }
  //2 Cehck if user already exists && password is correct
  const user = await User.findOne({ email }).select(
    '+password'
  );

  if (
    !user ||
    !(await user.correctPassword(password, user.password))
  ) {
    return next(
      new AppError('Incorrect Email or Password', 401)
    );
  }

  //3) If everything is correct then send back a token
  createAndSendToken(user, 200, res);
});
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};
exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError(
        'You are not logged in! Please log in to get access',
        401
      )
    );
  }

  //2) verifying token
  const decoded = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET
  );
  //3) check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(new AppError('User Does Not Exist', 401));
  }

  //4) Check if user changed password after the token was issued
  freshUser
    .changedPasswordAfter(decoded.iat)
    .then((result) => {
      if (result) {
        return next(
          new AppError(
            'User recently changed password! please login again.',
            401
          )
        );
      }
    });

  //grant access to protected route
  res.locals.user = freshUser;
  req.user = freshUser;
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    //roles ['admin','lead-guide], role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have the permission to perform this action',
          403
        )
      );
    }
    next();
  };

exports.forgotPassword = async (req, res, next) => {
  //1) Get user based on posted email
  const user = await User.findOne({
    email: req.body.email,
  });
  if (!user) {
    return next(
      new AppError(
        'There is no user with the provide email address.'
      ),
      404
    );
  }
  //2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  //3) Send it to user's email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Please try again',
        500
      )
    );
  }
};
exports.resetPassword = catchAsync(
  async (req, res, next) => {
    //1) Get user based on token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    //2) If token is not expired and user exists set the new password
    if (!user) {
      return next(
        new AppError('Tokrn has expired or is invalid', 400)
      );
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    //3) Update changePasswordAt property

    //4) Log the user in
    createAndSendToken(user, 200, res);
  }
);

exports.updatePassword = catchAsync(
  async (req, res, next) => {
    //1) Get user from the collection
    const user = await User.findById(req.user.id).select(
      '+password'
    );

    //2) Check if PoSTed password is valid
    if (
      !user.correctPassword(
        req.body.passwordCurrent,
        user.password
      )
    ) {
      return next(
        new AppError('Your current password is wrong', 401)
      );
    }

    //3) update the password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    //4) Log user in, send JWT

    createAndSendToken(user, 200, res);
  }
);

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (
        await currentUser.changedPasswordAfter(decoded.iat)
      ) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};
