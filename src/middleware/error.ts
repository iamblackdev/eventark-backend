import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
	console.log(err.message, err);
	res.status(500).send({ message: 'Server Error' });
	next();
};

export default errorMiddleware;
