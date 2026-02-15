import GoogleStrategy from 'passport-google-oidc';
import passport from 'passport';

passport.use(
	'google',
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL: 'http://localhost:4000/api/auth/redirect/google',
			scope: ['profile', 'email'],
		},
		(issuer, profile, done) => {
			// You MUST call done() - this is critical!
			const user = {
				googleId: profile.id,
				email: profile.emails?.[0]?.value,
				name: profile.displayName,
			};

			// Call done with the user object
			done(null, user);
		},
	),
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
	done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
	done(null, user);
});

export default passport;
