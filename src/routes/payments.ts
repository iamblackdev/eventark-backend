import * as crypto from 'crypto';
import { Request, Router } from 'express';
import Joi from 'joi';
import { numberWithCommas, sendEmail } from '../helpers';
import Event, { WishListModel } from '../models/Event';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);
import axios from 'axios';
import { ReceivedTransactionModel, WithdrawTransactionModel } from '../models/Transactions';
import { NotificationModel } from '../models/Notification';
import auth from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Initiate payment
router.post('/pay', async (req: Request, res: any) => {
	const { email, amount, name, itemId, eventId } = req.body;
	const { error } = validatePayload({ name, amount });

	if (error) res.status(400).json({ message: error.message });

	const trxObject: Record<string, string> = {
		amount,
		from: name,
		status: 'pending',
	};

	const eventIdValid = mongoose.Types.ObjectId.isValid(eventId);
	const itemIdValid = mongoose.Types.ObjectId.isValid(itemId);

	if (eventIdValid) {
		const event = await Event.findOne({ _id: eventId });
		trxObject['userId'] = event?.userId;
		trxObject['title'] = event?.title as string;
		trxObject['type'] = 'Tip';
	} else if (itemIdValid) {
		const item = await WishListModel.findOne({ _id: itemId });
		trxObject['userId'] = item?.userId as any;
		trxObject['title'] = item?.product_title as string;
		trxObject['type'] = 'Contribution';
	}

	if (!eventIdValid && !itemIdValid)
		return res.status(400).json({
			data: {
				message: 'Invalid request',
			},
		});

	try {
		const response = await axios.post(
			'https://api.paystack.co/transaction/initialize',
			{
				email: email || 'customer@eventark.com',
				amount: amount * 100,
				metadata: {
					email: email || 'customer@eventark.com',
					name,
					itemId,
					eventId,
					title: trxObject['title'],
					amount,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);

		trxObject['reference'] = response.data.data?.reference;
		// Save transaction to DB
		await ReceivedTransactionModel.create(trxObject);

		res.json({ ...response.data });
	} catch (err) {
		res.status(500).json({ error: 'Payment initiation failed' });
	}
});

// veryify payment status
router.get('/pay/verify/:reference', async (req: Request, res: any) => {
	const { reference } = req.params;
	const existing = await ReceivedTransactionModel.findOne({ reference });
	if (!existing) return res.status(404).json({ message: 'Transaction not found' });

	if (existing.status === 'success') return res.status(200).json({ data: { message: 'Already processed', status: existing.status } });

	const { data } = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
		headers: {
			Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
		},
	});

	if (data.data.status !== 'success') return res.status(400).json({ message: 'Payment not successful yet', status: existing.status });

	await processSuccessfulPayment(reference, data.data.metadata, data.data);
	return res.status(200).json({ data: { message: 'Transaction verified and processed', status: existing.status } });
});

// fetched received transaction for a user
router.get('/transaction/received', auth, async (req: Request, res: any) => {
	const transactions = await ReceivedTransactionModel.find({ userId: req.user?.id }).select('-userId');
	return res.status(200).json({ data: transactions });
});

// fetch withdaw transaction for a user
router.get('/transaction/withdraw', auth, async (req: Request, res: any) => {
	const transactions = await WithdrawTransactionModel.find({ userId: req.user?.id }).select('-userId');
	return res.status(200).json({ data: transactions });
});

router.post('/paystack/webhook', async (req: Request, res: any) => {
	const hash = crypto
		.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY as string)
		.update(JSON.stringify(req.body))
		.digest('hex');

	if (hash !== req.headers['x-paystack-signature']) {
		return res.status(401).send('Unauthorized');
	}

	const event = req.body;

	if (event.event === 'charge.success') {
		const { reference, metadata } = event.data;
		processSuccessfulPayment(reference, metadata, event.data);
	}

	res.sendStatus(200);
});

const processSuccessfulPayment = async (reference: string, metadata: any, rawData?: any) => {
	// Check if already processed
	const existing = await ReceivedTransactionModel.findOne({ reference });
	if (!existing || existing.status === 'success') return;

	// uspate trasaction
	await ReceivedTransactionModel.findOneAndUpdate({ reference }, { status: 'success', metadata: rawData || metadata });

	if (metadata.itemId) {
		const wish = await addContributor({
			wishListItemId: metadata.itemId,
			name: metadata.name,
			amount: metadata.amount,
		});

		// get user
		const user = await User.findOne({ _id: wish?.userId });

		// create notification
		await NotificationModel.create({
			eventId: wish?.eventId,
			userId: wish?.userId,
			message: `${metadata?.name} has just contributed ${numberWithCommas(metadata.amount)} for ${metadata.title}`,
		});

		// send email notification
		sendEmail({
			to: user?.email || '',
			subject: `${metadata.title} - New Contribution`,
			text: `${metadata?.name} has just contributed ₦${numberWithCommas(metadata.amount)} for ${metadata.title}`,
		});

		// check if item contirbution is 100%
		if (Number(wish?.total_contributions || 0) >= Number(wish?.total || 0)) {
			await NotificationModel.create({
				eventId: wish?.eventId,
				userId: wish?.userId,
				message: `Contributions for ‘${wish?.product_title}’ is 100% Complete.`,
			});

			sendEmail({
				to: user?.email || '',
				subject: `${metadata.title} - 100% Complete`,
				text: `Contributions for ‘${wish?.product_title}’ is 100% Complete.`,
			});
		}
	}

	if (metadata.eventId) {
		const updatedEvent = await Event.findByIdAndUpdate(metadata.eventId, { $inc: { tips: metadata.amount } }, { new: true });
		await NotificationModel.create({
			eventId: updatedEvent?.id,
			userId: updatedEvent?.userId,
			message: `${metadata?.name} has just tipped you ₦${numberWithCommas(metadata.amount)} for ${metadata.title}`,
		});

		const user = await User.findOne({ _id: updatedEvent?.userId });

		sendEmail({
			to: user?.email || '',
			subject: `${metadata.title} - New Tip`,
			text: `${metadata?.name} has just tipped you ₦${numberWithCommas(metadata.amount)} for ${metadata.title}`,
		});
	}
};

const addContributor = async ({ wishListItemId, name, amount }: { wishListItemId: string; name: string; amount: number }) => {
	const contributor = {
		name,
		amount,
		date: dayjs().toDate(),
	};

	return await WishListModel.findByIdAndUpdate(
		wishListItemId,
		{
			$push: { contributors: contributor },
			$inc: { total_contributions: amount },
		},
		{ new: true }
	);
};

const validatePayload = (val: Record<string, string | number>) => {
	const schema = Joi.object({
		name: Joi.string().required().min(3),
		amount: Joi.number().required().min(100),
	});

	return schema.validate(val);
};

export default router;
