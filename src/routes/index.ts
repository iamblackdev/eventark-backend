import express, { Express, Request, Response } from 'express';
import errorMiddleware from '../middleware/error';
import authRoutes from './auth';
import eventRoutes from './event';
import payments from './payments';
import dashboard from './dashboard';
import notification from './notifications';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';

export default function (app: Express) {
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(
		session({
			secret: process.env.SESSION_SECRET!, // Add this to your .env file
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: false, // true in production (HTTPS)
				httpOnly: true,
				maxAge: 24 * 60 * 60 * 1000, // 24 hours
				sameSite: 'lax',
			},
		}),
	);

	// Initialize Passport AFTER session
	app.use(passport.initialize());
	app.use(passport.session());

	app.get('/', (req: Request, res: Response) => {
		res.send('Hello from Node API Server Updated');
	});

	app.use('/api/auth', (req, res, next) => {
		// Remove restrictive headers for OAuth flow
		res.removeHeader('Referrer-Policy');
		res.removeHeader('X-Frame-Options');
		next();
	});
	app.use('/api/auth', authRoutes);
	app.use('/api/event', eventRoutes);
	app.use('/api', payments);
	app.use('/api/dashboard', dashboard);
	app.use('/api/notification', notification);
	app.use(errorMiddleware);
}
