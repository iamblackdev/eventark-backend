import express, { Express, Request, Response } from 'express';
import errorMiddleware from '../middleware/error';
import authRoutes from './auth';
import eventRoutes from './event';
import payments from './payments';
import dashboard from './dashboard';
import notification from './notifications';
import cors from 'cors';

export default function (app: Express) {
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.get('/', (req: Request, res: Response) => {
		res.send('Hello from Node API Server Updated');
	});
	app.use('/api/auth', authRoutes);
	app.use('/api/event', eventRoutes);
	app.use('/api', payments);
	app.use('/api/dashboard', dashboard);
	app.use('/api/notification', notification);
	app.use(errorMiddleware);
}
