const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const scriptSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://cdnjs.cloudflare.com/ajax/libs/axios/1.2.3/axios.min.js',
  'https://cdnjs.cloudflare.com/',
  'https://js.stripe.com/v3/',
];
const styleSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://fonts.googleapis.com/',
];
const connectSrcUrls = [
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'ws://localhost:1234/',
];
const fontSrcUrls = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());

app.options('*', cors());
//1) Middleware
//Serving static files
app.use(express.static(path.join(__dirname, 'public')));
//Set security http headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [],
      connectSrc: ["'self'", ...connectSrcUrls],
      scriptSrc: ["'self'", ...scriptSrcUrls],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        ...styleSrcUrls,
      ],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: [],
      imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
      fontSrc: ["'self'", ...fontSrcUrls],
    },
  })
);

//development logging
if (process.env.NODE_ENV !== 'production')
  app.use(morgan('dev'));

//limit requests from the same ip address
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message:
    'Too many requests from this IP, please try again in an hour.',
});

app.use('/api', limiter);

//Body parser, reading data from body into req.body
app.use(
  express.json({
    limit: '10kb',
  })
);
app.use(
  express.urlencoded({ extended: true, limit: '10kb' })
);
app.use(cookieParser());

//Data sanatization against NoSQL query injection
app.use(mongoSanitize());

//Data sanatization against XSS
app.use(xss());

//Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

app.use(compression());
//test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies.jwt);
  next();
});

//3 Routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/booking', bookingRouter);

app.all('*', (req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server`,
      404
    )
  );
});

app.use(globalErrorHandler);
module.exports = app;
