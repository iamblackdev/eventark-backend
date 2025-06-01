import cloudinary from '../config/cloudinary.service';
import { Readable } from 'stream';
import Joi from 'joi';
import { userPayloadType } from '../types';
import dayjs from 'dayjs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { genSalt, hash } from 'bcryptjs';
import mongoose from 'mongoose';
import User, { OTPModel } from '../models/User';

dotenv.config();

export const uploadToCloudinary = (buffer: Buffer, filename: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream({ public_id: filename, folder: 'eventArk' }, (error: any, result: any) => {
			if (error) return reject(error);
			if (result?.secure_url) return resolve(result.secure_url);
			reject(new Error('No secure_url in result'));
		});
		Readable.from(buffer).pipe(stream);
	});
};

export const numberWithCommas = (x: string | number, decimal = true) => {
	const val = Math.round(Number(x) * 100) / 100;
	const parts = val.toFixed(2).toString().split('.');
	var num = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	if (decimal) {
		var num = num + (parts[1] ? `.${parts[1]}` : '');
	}
	return num;
};

// src/utils/cascadeDelete.ts

export async function handleEventCascadeDelete(event: any) {
	if (!event) return;

	const session = await mongoose.startSession();
	session.startTransaction();
	try {
		// Delete referenced wish list items
		if (event.wish_list?.length) {
			await mongoose
				.model('WishList')
				.deleteMany({ _id: { $in: event.wish_list } })
				.session(session);
		}

		// Delete party details
		if (event.party_details) {
			await mongoose.model('EventParty').findByIdAndDelete(event.party_details).session(session);
		}

		// Delete anonymous messages
		if (event.messages?.length) {
			await mongoose
				.model('AnonymousMessage')
				.deleteMany({ _id: { $in: event.messages } })
				.session(session);
		}

		await session.commitTransaction();
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
}

export async function unlinkFromEvent(modelName: string, field: string, docId: mongoose.Types.ObjectId, isArray = true) {
	const TargetModel = mongoose.model(modelName);

	const updateQuery = isArray ? { $pull: { [field]: docId } } : { $unset: { [field]: '' } };

	await TargetModel.updateMany({ [field]: docId }, updateQuery);
}

export const validateCreateUserPayLoad = (customer: userPayloadType) => {
	const schema = Joi.object({
		email: Joi.string().email().required(),
		first_name: Joi.string().min(3).required(),
		last_name: Joi.string().min(3).required(),
		password: Joi.string().min(6).required(),
	});

	return schema.validate(customer);
};

export const validateUpdateUserPayLoad = (customer: userPayloadType) => {
	const schema = Joi.object({
		first_name: Joi.string().min(3),
		last_name: Joi.string().min(3),
		gender: Joi.string(),
		dob: Joi.string(),
	});

	return schema.validate(customer);
};

export const generateOtpCode = async (email: string) => {
	const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
	const expiresAt = dayjs().add(30, 'minute').toDate();

	await OTPModel.findOneAndUpdate({ email }, { code, expiresAt }, { upsert: true, new: true });

	await sendEmail({
		to: email,
		subject: 'Your OTP Code',
		text: `Your OTP code is: ${code}. It expires in 30 minutes.`,
	});
};

export const sendEmail = async ({ to, subject, text }: { to: string; subject: string; text: string }) => {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	await transporter.sendMail({
		from: `"Eventark" <${process.env.EMAIL_USER}>`,
		to,
		subject,
		text,
	});
};

export const verifyOtp = async ({ email, code }: { email: string; code: string }) => {
	const otpEntry = await OTPModel.findOne({ email, code });
	if (!otpEntry) throw new Error('OTP Invalid');
	if (otpEntry.expiresAt < new Date()) throw new Error('OTP expired');
};

export const verifyOtpAndResetPassword = async ({ email, newPassword, code }: { email: string; code: string; newPassword: string }) => {
	await verifyOtp({ email, code });
	const salt = await genSalt(10);
	const hashedPassword = await hash(newPassword, salt);

	await User.findOneAndUpdate({ email }, { password: hashedPassword });

	await OTPModel.deleteOne({ email });
};
