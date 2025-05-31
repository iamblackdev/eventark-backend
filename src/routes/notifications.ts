import { Request, Router } from 'express';
import auth from '../middleware/auth';
import { NotificationModel } from '../models/Notification';

const router = Router();
// dashboard
router.get('/', auth, async (req: Request, res: any) => {
	try {
		const userId = req.user?.id; // assuming user ID is available from auth middleware
		const { eventId } = req.query;

		const query: any = { userId };

		if (eventId) {
			query.eventId = eventId;
		}

		const notifications = await NotificationModel.find(query).sort({ createdAt: -1 });

		res.status(200).json({ data: notifications });
	} catch (error) {
		res.status(500).json({ data: { message: 'Failed to fetch notifications' } });
	}
});

export default router;
