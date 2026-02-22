import { Request, Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import auth from '../middleware/auth';
import { generateOtpCode, validateCreateUserPayLoad, validateUpdateUserPayLoad, verifyOtp, verifyOtpAndResetPassword } from '../helpers';
import dayjs from 'dayjs';
import passport from '../config/passportConfig';

const router = Router();

// Google OAuth initiation
router.get(
	'/google',
	passport.authenticate('google', {
		scope: ['profile', 'email'],
	}),
);

// Google OAuth callback
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

router.get(
	'/redirect/google',
	passport.authenticate('google', {
		failureRedirect: `${FRONTEND_URL}/login`,
	}),
	async (req: any, res: any) => {
		console.log(FRONTEND_URL);
		try {
			const googleUser = req.user;

			let user = await User.findOne({ email: googleUser.email });

			if (!user) {
				user = new User({
					email: googleUser.email,
					name: googleUser.name,
					googleId: googleUser.googleId,
					email_verified: true,
					email_verified_at: dayjs().toDate(),
				});
				await user.save();
			} else if (!user.googleId) {
				user.googleId = googleUser.googleId;
				await user.save();
			}

			const token = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

			//  Dynamic redirect
			res.redirect(`${FRONTEND_URL}/app?token=${token}`);
		} catch (error) {
			console.error('Google auth error:', error);
			res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
		}
	},
);

// Register
router.post('/register', async (req: Request, res: any) => {
	const { error } = validateCreateUserPayLoad(req.body);
	if (error) return res.status(400).json({ message: error.message });

	let user = await User.findOne({ email: req.body.email });
	if (user) return res.status(400).json({ message: 'Email already registered' });

	user = new User(req.body);
	await user.save();

	await generateOtpCode(req.body.email!);

	user = await User.findOne({ email: req.body.email });

	const token = jwt.sign({ email: req.body.email, id: user?._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
	res.json({ data: { token, user } });
});

// Login
router.post('/login', async (req: Request, res: any) => {
	const { email, password } = req.body;
	let user = await User.findOne({ email }).select('+password');
	if (!user || !(await user.matchPassword(password))) {
		return res.status(400).json({ message: 'Invalid credentials' });
	}

	user = await User.findOne({ email });

	const token = jwt.sign({ email: req.body.email, id: user?._id }, process.env.JWT_SECRET!);
	res.json({ data: { token, user } });
});

// User data
router.get('/me', auth, async (req, res) => {
	const user = await User.findOne({ email: req.user?.email }).select('-password');
	res.json({ data: user });
});

// update user
router.patch('/update', auth, async (req: Request, res: any) => {
	try {
		const userId = req.user?.id;
		const updateFields = req.body;

		const allowedFields = ['first_name', 'last_name', 'gender', 'dob'];
		const updates: any = {};

		for (const key of allowedFields) {
			if (updateFields[key] !== undefined) {
				updates[key] = updateFields[key];
			}
		}

		const { error } = validateUpdateUserPayLoad(updates);

		if (error) return res.status(400).json({ message: error.message });

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({ message: 'No valid fields provided for update' });
		}

		const updatedUser = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select('-password');

		if (!updatedUser) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.status(200).json({ data: { message: 'User updated successfully', user: updatedUser } });
	} catch (error) {
		console.error('Update error:', error);
		res.status(500).json({ message: 'Something went wrong' });
	}
});

// send email verification code
router.get('/resend-mail-otp', auth, async (req: Request, res: any) => {
	const email = req.user?.email;

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ message: 'User not found' });
	if (user?.email_verified) return res.status(404).json({ message: 'Email alredy verified' });

	await generateOtpCode(email!);
	res.json({ message: 'OTP sent to email' });
});

// verify email
router.post('/verify-email', auth, async (req: Request, res: any) => {
	const email = req.user?.email;
	const code = req.body?.otp;

	if (!code) throw new Error('OTP Required');
	if (code.length !== 6) throw new Error('Invalid OTP');
	try {
		let user = await User.findOne({ email });
		if (!user) return res.status(404).json({ message: 'User not found' });

		await verifyOtp({ code, email: email! });

		user.email_verified = true;
		user.email_verified_at = dayjs().toDate();

		await user.save();

		user = await User.findOne({ email });
		res.json({ message: 'Email Verified', data: user });
	} catch (err: any) {
		res.status(400).json({ message: err.message });
	}
});

// request reset passsword
router.post('/request-password-reset', async (req: Request, res: any) => {
	const email = req.body?.email;

	if (!email) return res.status(404).json({ message: 'Email is required' });

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ message: 'User not found' });

	await generateOtpCode(email);
	res.json({ message: 'OTP sent to email' });
});

// reset passsword
router.post('/reset-password', async (req, res) => {
	const { email, code, password } = req.body;
	try {
		await verifyOtpAndResetPassword({ email, code, newPassword: password });
		res.json({ message: 'Password reset successful' });
	} catch (err: any) {
		res.status(400).json({ message: err.message });
	}
});

export default router;
