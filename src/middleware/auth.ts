import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export default function (req: Request, res: Response, next: NextFunction) {
	const token = req.header('x-auth-token');

	if (!token) {
		res.status(401).send({ message: 'Access denined, no token provided' });
		return;
	}

	try {
		const decode = jwt.verify(token, process.env.JWT_SECRET!);
		req.user = decode as { email: string; id: string };
		next();
	} catch (error) {
		res.status(400).send({ message: 'Invalid token' });
	}
}
