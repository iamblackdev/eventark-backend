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
import MongoStore from 'connect-mongo';

const isProduction = process.env.NODE_ENV === 'production';

export default function (app: Express) {
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	app.use(
		session({
			store: MongoStore.create({
				mongoUrl: process.env.MONGO_URI!,
				collectionName: 'sessions',
				ttl: 24 * 60 * 60,
			}),
			secret: process.env.SESSION_SECRET!,
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: isProduction,
				httpOnly: true,
				maxAge: 24 * 60 * 60 * 1000,
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

	app.get('/health', (_, res) => {
		res.status(200).send('ok');
	});

	app.use('/api/auth', authRoutes);
	app.use('/api/event', eventRoutes);
	app.use('/api', payments);
	app.use('/api/dashboard', dashboard);
	app.use('/api/notification', notification);
	app.use(errorMiddleware);
}
