# TaskUp

TaskUp is a task management application for creating and managing tasks.

## Run locally

```bash
npm install
npm start
```

The app uses `data/users.json` and `data/task.json` locally. Copy `.env` from your local setup and provide a strong `JWT_SECRET`.

## Deploy to Netlify

The Express app runs through the Netlify function at `netlify/functions/taskup.js`. Netlify's filesystem is not persistent, so configure these environment variables in the Netlify site settings:

- `MONGODB_URI`: MongoDB connection string for the database that stores `users` and `task` collections.
- `JWT_SECRET`: long random string used to sign authentication tokens.
- `resend_api_key`: Resend API key, if task email sending is needed.

Deploy with the Netlify CLI or connect the GitHub repository. The repository includes `netlify.toml`, which configures the function directory, static assets, bundling, and catch-all redirect.