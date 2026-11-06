[README.md](https://github.com/user-attachments/files/34474279/README.md)
# SeatMate deployment

This folder contains only the files needed to build and host the SeatMate website:

- `web/` - React frontend and its images.
- `src/SeatMateWeb.java` - Java API server.
- `database.sql` - MySQL tables and demo routes.
- `lib/mysql-connector-j-9.4.0.jar` - MySQL driver required by the server.
- `Dockerfile`, `railway.json` - Railway backend deployment.
- `.github/workflows/deploy-pages.yml` - GitHub Pages frontend deployment.

## Host the full app

GitHub Pages hosts the frontend; Railway runs the Java API and MySQL database.
The frontend requires the Railway API URL to be configured before Pages can build.

1. Push this folder's contents to the `main` branch of a GitHub repository.
2. In Railway, create a MySQL service and a Java service connected to the repository.
   The Java service should build from the root `Dockerfile`.
3. In the Railway MySQL query console, run `database.sql` once to create the schema
   and seed routes. Do not run it again if the database already contains data.
4. Create an application database user in the MySQL console. Use a new strong
   password and keep it in Railway only:

   ```sql
   CREATE USER 'seatmate_app'@'%' IDENTIFIED BY 'replace-with-a-strong-password';
   GRANT SELECT, INSERT ON seatmate_core.* TO 'seatmate_app'@'%';
   GRANT UPDATE ON seatmate_core.trips TO 'seatmate_app'@'%';
   GRANT DELETE ON seatmate_core.bookings TO 'seatmate_app'@'%';
   ```

5. Add these variables to the Railway Java service. Replace `MySQL` with the exact
   name of the Railway database service. Set `DB_PASSWORD` directly in Railway;
   never add it to GitHub:

   ```text
   MYSQLHOST=${{MySQL.MYSQLHOST}}
   MYSQLPORT=${{MySQL.MYSQLPORT}}
   DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/seatmate_core?serverTimezone=Asia/Kolkata
   DB_USER=seatmate_app
   DB_PASSWORD=<set-in-Railway>
   FRONTEND_ORIGINS=https://nithiya31007-cmd.github.io
   ```

   Leave `SEATMATE_DEMO_BOOKING_OPEN` unset. Generate a public domain for the Java
   service and check that `https://YOUR-RAILWAY-DOMAIN/health` responds with `ok`.
6. In GitHub repository Settings → Secrets and variables → Actions → Variables, add
   `VITE_API_BASE_URL` with the Railway service origin, such as
   `https://your-service.up.railway.app` (no trailing slash). Under Settings →
   Pages, select **GitHub Actions** as the deployment source.
7. Push to `main` or run **Deploy SeatMate frontend to GitHub Pages** from the
   Actions tab. GitHub displays the published page URL in the deployment.

## Run locally

Requirements: JDK 17+, Node.js 22+, npm, and MySQL 8+.

1. Run `database.sql` once in your local MySQL server.
2. Build the frontend:

   ```sh
   cd web
   npm ci
   npm run build
   cd ..
   ```

3. Compile the backend:

   ```sh
   mkdir -p bin
   javac -cp "lib/*" -d bin src/SeatMateWeb.java
   ```

4. Set `DB_USER` and `DB_PASSWORD` for your local database, then start the server:

   ```sh
   java -cp "bin:lib/*" SeatMateWeb
   ```

5. Open <http://localhost:8000>.

## Important security note

This is a public demonstration, not production authentication. Login accepts any
valid-looking email without verifying ownership, so another person could access
bookings by entering that email. Do not use real student data or personal bookings
until verified college sign-in and authorization are implemented.
