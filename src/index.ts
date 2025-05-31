import express, { Express } from 'express';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import routes from './routes';

config();

const app: Express = express();

routes(app);

async function startServer() {
	try {
		await mongoose.connect(process.env.MONGO_URI!);

		const PORT = process.env.PORT || 4000;
		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (err) {
		console.error('Failed to start server:', err);
		process.exit(1);
	}
}

startServer();
