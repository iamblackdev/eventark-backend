import { Request, Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import auth from '../middleware/auth';
import { generateOtpCode, validateCreateUserPayLoad, validateUpdateUserPayLoad, verifyOtpAndResetPassword } from '../helpers';

const router = Router();

// Register
router.post('/register', async (req: Request, res: any) => {
	const { error } = validateCreateUserPayLoad(req.body);
	if (error) return res.status(400).json({ message: error.message });

	let user = await User.findOne({ email: req.body.email });
	if (user) return res.status(400).json({ message: 'Email already registered' });

	user = new User(req.body);
	await user.save();

	user = await User.findOne({ email: req.body.email });

	const token = jwt.sign({ email: req.body.email, id: user?._id }, process.env.JWT_SECRET!);
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

// reset passsword
router.post('/request-password-reset', async (req: Request, res: any) => {
	const email = req.body?.email;

	if (!email) return res.status(404).json({ message: 'Email is required' });

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ message: 'User not found' });

	await generateOtpCode(email);
	res.json({ message: 'OTP sent to email' });
});

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
