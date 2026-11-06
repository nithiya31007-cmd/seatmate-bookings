import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;

public final class SeatMateWeb {
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Path WEB_ROOT = Path.of("web", "dist").toAbsolutePath().normalize();
    private static final Set<String> ALLOWED_ORIGINS = allowedOriginsFromEnvironment();
    private static final Map<String, Shift> SHIFTS = Map.of(
        "early", new Shift(LocalTime.of(15, 15), LocalTime.of(14, 45), LocalTime.of(15, 5)),
        "late", new Shift(LocalTime.of(17, 0), LocalTime.of(16, 45), LocalTime.of(17, 0))
    );
    private static final DemoSeat DEMO_RESERVED_SEAT = demoSeatFromEnvironment();

    private SeatMateWeb() { }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8000"));
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/api/login", SeatMateWeb::handleLogin);
        server.createContext("/api/routes", SeatMateWeb::handleRoutes);
        server.createContext("/api/bookings", SeatMateWeb::handleBookings);
        server.createContext("/health", exchange -> {
            if (methodIs(exchange, "GET")) {
                sendText(exchange, 200, "ok", "text/plain; charset=utf-8");
            }
        });
        server.createContext("/", SeatMateWeb::serveStatic);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("SeatMate website and API running at http://localhost:" + port);
    }

    private static Connection connect() throws SQLException {
        String databaseHost = System.getenv().getOrDefault("MYSQLHOST", "localhost");
        String databasePort = System.getenv().getOrDefault("MYSQLPORT", "3306");
        String databaseName = System.getenv().getOrDefault("MYSQLDATABASE", "seatmate_core");
        String url = System.getenv().getOrDefault(
            "DB_URL",
            "jdbc:mysql://" + databaseHost + ":" + databasePort + "/" +
                databaseName + "?serverTimezone=Asia/Kolkata"
        );
        String user = System.getenv().getOrDefault(
            "DB_USER", System.getenv().getOrDefault("MYSQLUSER", "seatmate_app")
        );
        String password = System.getenv().getOrDefault(
            "DB_PASSWORD", System.getenv().getOrDefault("MYSQLPASSWORD", "")
        );
        return DriverManager.getConnection(url, user, password);
    }

    private static void handleLogin(HttpExchange exchange) throws IOException {
        if (!handleCors(exchange)) return;
        if (!methodIs(exchange, "POST")) return;
        Map<String, String> form = readForm(exchange);
        String email = normalizeEmail(form.get("email"));
        if (email == null) {
            sendJson(exchange, 400, error("Enter a valid college email address."));
            return;
        }
        String name = email.substring(0, email.indexOf('@'));
        if (name.length() > 100) name = name.substring(0, 100);
        try (Connection connection = connect()) {
            try (PreparedStatement insert = connection.prepareStatement(
                "INSERT IGNORE INTO users(email,name,role) VALUES(?,?,'STUDENT')"
            )) {
                insert.setString(1, email);
                insert.setString(2, name);
                insert.executeUpdate();
            }
            try (PreparedStatement query = connection.prepareStatement(
                "SELECT name,role FROM users WHERE email=?"
            )) {
                query.setString(1, email);
                try (ResultSet result = query.executeQuery()) {
                    if (!result.next()) {
                        throw new SQLException("Account could not be loaded after login.");
                    }
                sendJson(exchange, 200, "{\"email\":" + quote(email) +
                    ",\"name\":" + quote(result.getString("name")) +
                    ",\"role\":" + quote(result.getString("role")) + "}");
                }
            }
        } catch (SQLException exception) {
            databaseError(exchange, exception);
        }
    }

    private static void handleRoutes(HttpExchange exchange) throws IOException {
        if (!handleCors(exchange)) return;
        if (!methodIs(exchange, "GET")) return;
        String shiftKey = query(exchange).get("shift");
        Shift shift = SHIFTS.get(shiftKey);
        if (shift == null) {
            sendJson(exchange, 400, error("Choose a valid evening shift."));
            return;
        }
        LocalDate today = LocalDate.now(IST);
        try (Connection connection = connect()) {
            createTodayTrips(connection, today);
            String sql = "SELECT t.id,b.number,b.destination,b.stops,b.capacity,b.staff_only," +
                "s.departure,s.opens,s.closes " +
                "FROM trips t JOIN schedules s ON s.id=t.schedule_id " +
                "JOIN buses b ON b.id=s.bus_id " +
                "WHERE t.travel_date=? AND s.departure=? ORDER BY b.id";
            try (PreparedStatement query = connection.prepareStatement(sql)) {
                query.setObject(1, today);
                query.setObject(2, shift.departure);
                try (ResultSet result = query.executeQuery()) {
                    List<String> routeJson = new ArrayList<>();
                    while (result.next()) {
                        long tripId = result.getLong("id");
                        int capacity = result.getInt("capacity");
                        Set<Integer> reserved = reservedSeats(connection, tripId);
                        String routeNo = result.getString("number");
                        int demoSeat = demoReservedSeat(routeNo, shiftKey);
                        if (demoSeat > capacity) {
                            throw new SQLException("Demo reserved seat exceeds route capacity for " + routeNo + ".");
                        }
                        if (demoSeat > 0) reserved.add(demoSeat);
                        List<String> stopJson = new ArrayList<>();
                        for (String stop : result.getString("stops").split(",\\s*")) {
                            stopJson.add(quote(stop));
                        }
                        List<String> availableJson = new ArrayList<>();
                        List<String> bookedJson = new ArrayList<>();
                        for (int seat = 1; seat <= capacity; seat++) {
                            if (reserved.contains(seat)) {
                                bookedJson.add(Integer.toString(seat));
                            } else {
                                availableJson.add(Integer.toString(seat));
                            }
                        }
                        String bookingStatus = bookingStatus(
                            result.getTime("opens").toLocalTime(),
                            result.getTime("closes").toLocalTime(),
                            currentTime()
                        );
                        routeJson.add("{\"tripId\":" + tripId +
                            ",\"routeNo\":" + quote(routeNo) +
                            ",\"destination\":" + quote(result.getString("destination")) +
                            ",\"stops\":[" + String.join(",", stopJson) + "]" +
                            ",\"capacity\":" + capacity +
                            ",\"seatsAvailable\":" + (capacity - reserved.size()) +
                            ",\"availableSeats\":[" + String.join(",", availableJson) + "]" +
                            ",\"bookedSeats\":[" + String.join(",", bookedJson) + "]" +
                            ",\"demoReservedSeat\":" + (demoSeat == 0 ? "null" : Integer.toString(demoSeat)) +
                            ",\"staffOnly\":" + result.getBoolean("staff_only") +
                            ",\"departure\":" + quote(result.getTime("departure").toLocalTime().toString()) +
                            ",\"demoBookingOpen\":" + demoBookingOpen() +
                            ",\"bookingStatus\":" + quote(bookingStatus) + "}");
                    }
                    sendJson(exchange, 200, "{\"date\":" + quote(today.toString()) +
                        ",\"shift\":" + quote(shiftKey) +
                        ",\"routes\":[" + String.join(",", routeJson) + "]}");
                }
            }
        } catch (SQLException exception) {
            databaseError(exchange, exception);
        }
    }

    private static void handleBookings(HttpExchange exchange) throws IOException {
        if (!handleCors(exchange)) return;
        if (exchange.getRequestMethod().equals("GET")) {
            Map<String, String> params = query(exchange);
            String email = normalizeEmail(params.get("email"));
            if (email == null) {
                sendJson(exchange, 400, error("A valid college email is required."));
                return;
            }
            LocalDate today = LocalDate.now(IST);
            boolean history = "all".equals(params.get("history"));
            String sql = "SELECT k.id,b.number,b.destination,k.seat_no,s.departure,k.travel_date " +
                "FROM bookings k JOIN trips t ON t.id=k.trip_id " +
                "JOIN schedules s ON s.id=t.schedule_id JOIN buses b ON b.id=s.bus_id " +
                "JOIN users u ON u.id=k.user_id " +
                "WHERE u.email=?" + (history ? "" : " AND k.travel_date=?") +
                " ORDER BY k.travel_date DESC,s.departure";
            try (Connection connection = connect();
                 PreparedStatement query = connection.prepareStatement(sql)) {
                query.setString(1, email);
                if (!history) query.setObject(2, today);
                try (ResultSet result = query.executeQuery()) {
                    List<String> rows = new ArrayList<>();
                    while (result.next()) {
                        LocalTime departure = result.getTime("departure").toLocalTime();
                        rows.add("{\"id\":" + result.getLong("id") +
                            ",\"routeNo\":" + quote(result.getString("number")) +
                            ",\"destination\":" + quote(result.getString("destination")) +
                            ",\"seat\":" + result.getInt("seat_no") +
                            ",\"departure\":" + quote(departure.toString()) +
                            ",\"shift\":" + quote(departure.equals(LocalTime.of(15, 15)) ? "early" : "late") +
                            ",\"date\":" + quote(result.getDate("travel_date").toLocalDate().toString()) + "}");
                    }
                    sendJson(exchange, 200, "{\"bookings\":[" + String.join(",", rows) + "]}");
                }
            } catch (SQLException exception) {
                databaseError(exchange, exception);
            }
            return;
        }
        if (exchange.getRequestMethod().equals("DELETE")) {
            Map<String, String> form = readForm(exchange);
            String email = normalizeEmail(form.get("email"));
            long bookingId;
            try {
                bookingId = Long.parseLong(form.getOrDefault("bookingId", ""));
            } catch (NumberFormatException exception) {
                sendJson(exchange, 400, error("Choose a valid booking to remove."));
                return;
            }
            if (email == null || bookingId < 1) {
                sendJson(exchange, 400, error("A valid email and booking are required."));
                return;
            }
            try (Connection connection = connect()) {
                long userId = registeredUserId(connection, email);
                try (PreparedStatement delete = connection.prepareStatement(
                    "DELETE FROM bookings WHERE id=? AND user_id=?"
                )) {
                    delete.setLong(1, bookingId);
                    delete.setLong(2, userId);
                    if (delete.executeUpdate() == 0) {
                        sendJson(exchange, 404, error("This booking was not found in your history."));
                        return;
                    }
                }
                sendJson(exchange, 200, "{\"deleted\":true}");
            } catch (IllegalArgumentException exception) {
                sendJson(exchange, 404, error(exception.getMessage()));
            } catch (SQLException exception) {
                databaseError(exchange, exception);
            }
            return;
        }
        if (!exchange.getRequestMethod().equals("POST")) {
            sendJson(exchange, 405, error("Method not allowed."));
            return;
        }

        Map<String, String> form = readForm(exchange);
        String email = normalizeEmail(form.get("email"));
        String routeNo = form.get("routeNo");
        String shiftKey = form.get("shift");
        Shift shift = SHIFTS.get(shiftKey);
        int seat;
        try {
            seat = Integer.parseInt(form.getOrDefault("seat", ""));
        } catch (NumberFormatException exception) {
            sendJson(exchange, 400, error("Choose an available seat."));
            return;
        }
        if (email == null || routeNo == null || shift == null || seat < 1) {
            sendJson(exchange, 400, error("Email, evening shift, route, and seat are required."));
            return;
        }

        LocalDate today = LocalDate.now(IST);
        try (Connection connection = connect()) {
            connection.setAutoCommit(false);
            try {
                createTodayTrips(connection, today);
                long userId = registeredUserId(connection, email);
                BusTrip trip = findTrip(connection, routeNo, shift, today);
                if (trip.staffOnly) {
                    connection.rollback();
                    sendJson(exchange, 403, error("This route is for staff only and cannot be booked by students or teachers."));
                    return;
                }
                if (seat > trip.capacity) {
                    connection.rollback();
                    sendJson(exchange, 400, error("Choose a valid seat number."));
                    return;
                }
                LocalTime current = currentTime();
                if (!demoBookingOpen() && current.isBefore(trip.opens)) {
                    connection.rollback();
                    sendJson(exchange, 409, error("Booking opens at " + trip.opens + "."));
                    return;
                }
                if (!demoBookingOpen() && !current.isBefore(trip.closes)) {
                    connection.rollback();
                    sendJson(exchange, 409, error("Booking closed."));
                    return;
                }
                if (alreadyBooked(connection, userId, today, shift.departure)) {
                    connection.rollback();
                    sendJson(exchange, 409, error("You already have a booking for this shift. Only one seat per person is allowed."));
                    return;
                }
                if (seatAlreadyReserved(connection, trip.tripId, seat) ||
                    demoReservedSeat(routeNo, shiftKey) == seat) {
                    connection.rollback();
                    sendJson(exchange, 409, error("That seat is no longer available. Refresh the route list and choose another seat."));
                    return;
                }
                int reservedCount = reservedSeatCount(connection, trip.tripId);
                int demoSeat = demoReservedSeat(routeNo, shiftKey);
                if (demoSeat > 0 && !seatAlreadyReserved(connection, trip.tripId, demoSeat)) {
                    reservedCount++;
                }
                if (reservedCount >= trip.capacity) {
                    connection.rollback();
                    sendJson(exchange, 409, error("This bus is fully booked. Please check another route."));
                    return;
                }
                try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO bookings(user_id,trip_id,travel_date,departure,seat_no) VALUES(?,?,?,?,?)"
                )) {
                    insert.setLong(1, userId);
                    insert.setLong(2, trip.tripId);
                    insert.setObject(3, today);
                    insert.setObject(4, shift.departure);
                    insert.setInt(5, seat);
                    insert.executeUpdate();
                }
                connection.commit();
                sendJson(exchange, 201, "{\"email\":" + quote(email) +
                    ",\"date\":" + quote(today.toString()) +
                    ",\"shift\":" + quote(shiftKey) +
                    ",\"routeNo\":" + quote(routeNo) +
                    ",\"destination\":" + quote(trip.destination) +
                    ",\"seat\":" + seat +
                    ",\"departure\":" + quote(shift.departure.toString()) + "}");
            } catch (SQLIntegrityConstraintViolationException exception) {
                connection.rollback();
                sendJson(exchange, 409, error("Seat taken, or you already booked this shift. Refresh the routes and try again."));
            } catch (SQLException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            }
        } catch (IllegalArgumentException exception) {
            sendJson(exchange, 404, error(exception.getMessage()));
        } catch (SQLException exception) {
            databaseError(exchange, exception);
        }
    }

    private static long registeredUserId(Connection connection, String email) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT id FROM users WHERE email=? AND role IN ('STUDENT','TEACHER')"
        )) {
            query.setString(1, email);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalArgumentException(
                        "This email is not registered as a student or teacher."
                    );
                }
                return result.getLong(1);
            }
        }
    }

    private static BusTrip findTrip(
        Connection connection, String routeNo, Shift shift, LocalDate date
    ) throws SQLException {
        String sql = "SELECT t.id,b.capacity,b.staff_only,b.destination,s.opens,s.closes " +
            "FROM trips t JOIN schedules s ON s.id=t.schedule_id " +
            "JOIN buses b ON b.id=s.bus_id " +
            "WHERE b.number=? AND s.departure=? AND t.travel_date=? FOR UPDATE OF t";
        try (PreparedStatement query = connection.prepareStatement(sql)) {
            query.setString(1, routeNo);
            query.setObject(2, shift.departure);
            query.setObject(3, date);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new IllegalArgumentException("Route not found for this evening shift.");
                return new BusTrip(
                    result.getLong("id"),
                    result.getInt("capacity"),
                    result.getBoolean("staff_only"),
                    result.getString("destination"),
                    result.getTime("opens").toLocalTime(),
                    result.getTime("closes").toLocalTime()
                );
            }
        }
    }

    private static boolean alreadyBooked(
        Connection connection, long userId, LocalDate date, LocalTime departure
    ) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT 1 FROM bookings WHERE user_id=? AND travel_date=? AND departure=?"
        )) {
            query.setLong(1, userId);
            query.setObject(2, date);
            query.setObject(3, departure);
            try (ResultSet result = query.executeQuery()) {
                return result.next();
            }
        }
    }

    private static boolean seatAlreadyReserved(Connection connection, long tripId, int seat)
        throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT 1 FROM bookings WHERE trip_id=? AND seat_no=?"
        )) {
            query.setLong(1, tripId);
            query.setInt(2, seat);
            try (ResultSet result = query.executeQuery()) {
                return result.next();
            }
        }
    }

    private static int reservedSeatCount(Connection connection, long tripId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*) FROM bookings WHERE trip_id=?"
        )) {
            query.setLong(1, tripId);
            try (ResultSet result = query.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private static Set<Integer> reservedSeats(Connection connection, long tripId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT seat_no FROM bookings WHERE trip_id=?"
        )) {
            query.setLong(1, tripId);
            try (ResultSet result = query.executeQuery()) {
                Set<Integer> seats = new HashSet<>();
                while (result.next()) seats.add(result.getInt(1));
                return seats;
            }
        }
    }

    private static void createTodayTrips(Connection connection, LocalDate today) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT IGNORE INTO trips(schedule_id,travel_date) SELECT id,? FROM schedules"
        )) {
            insert.setObject(1, today);
            insert.executeUpdate();
        }
    }

    private static LocalTime currentTime() {
        LocalDateTime real = LocalDateTime.now(IST);
        String demo = System.getenv("SEATMATE_DEMO_TIME");
        return demo == null || demo.isBlank() ? real.toLocalTime() : LocalTime.parse(demo);
    }

    private static boolean demoBookingOpen() {
        return "true".equalsIgnoreCase(System.getenv("SEATMATE_DEMO_BOOKING_OPEN"));
    }

    private static DemoSeat demoSeatFromEnvironment() {
        String configured = System.getenv("SEATMATE_DEMO_RESERVED_SEAT");
        if (configured == null || configured.isBlank()) return null;
        String[] parts = configured.trim().split(":", -1);
        if (parts.length != 3 || parts[0].isBlank() || !SHIFTS.containsKey(parts[1])) {
            throw new IllegalArgumentException(
                "SEATMATE_DEMO_RESERVED_SEAT must use the format route:shift:seat, for example 1C:early:8."
            );
        }
        int seat;
        try {
            seat = Integer.parseInt(parts[2]);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("SEATMATE_DEMO_RESERVED_SEAT must include a numeric seat.", exception);
        }
        if (seat < 1 || seat > 40) {
            throw new IllegalArgumentException("SEATMATE_DEMO_RESERVED_SEAT must be between 1 and 40.");
        }
        return new DemoSeat(parts[0], parts[1], seat);
    }

    private static int demoReservedSeat(String routeNo, String shiftKey) {
        if (!demoBookingOpen() || DEMO_RESERVED_SEAT == null) return 0;
        return DEMO_RESERVED_SEAT.routeNo.equals(routeNo) && DEMO_RESERVED_SEAT.shiftKey.equals(shiftKey)
            ? DEMO_RESERVED_SEAT.seat
            : 0;
    }

    private static String bookingStatus(LocalTime opens, LocalTime closes, LocalTime current) {
        if (demoBookingOpen()) return "Demo booking open";
        if (current.isBefore(opens)) return "Booking opens at " + formatTime(opens);
        if (!current.isBefore(closes)) return "Booking closed.";
        return "Booking open";
    }

    private static String formatTime(LocalTime time) {
        int hour = time.getHour();
        return (hour % 12 == 0 ? 12 : hour % 12) + ":" +
            String.format("%02d", time.getMinute()) + (hour < 12 ? " AM" : " PM");
    }

    private static String normalizeEmail(String email) {
        if (email == null) return null;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= 190 &&
            normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") ? normalized : null;
    }

    private static boolean methodIs(HttpExchange exchange, String method) throws IOException {
        if (exchange.getRequestMethod().equals(method)) return true;
        sendJson(exchange, 405, error("Method not allowed."));
        return false;
    }

    private static Set<String> allowedOriginsFromEnvironment() {
        String configured = System.getenv("FRONTEND_ORIGINS");
        if (configured == null || configured.isBlank()) {
            return Set.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8000",
                "http://127.0.0.1:8000"
            );
        }
        Set<String> origins = new HashSet<>();
        for (String origin : configured.split(",")) {
            String normalized = origin.trim();
            if (!normalized.isEmpty()) origins.add(normalized);
        }
        if (origins.isEmpty()) {
            throw new IllegalArgumentException("FRONTEND_ORIGINS must contain at least one origin.");
        }
        return Set.copyOf(origins);
    }

    private static boolean handleCors(HttpExchange exchange) throws IOException {
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        exchange.getResponseHeaders().set("Vary", "Origin");
        if (origin != null && !ALLOWED_ORIGINS.contains(origin)) {
            sendJson(exchange, 403, error("This website origin is not allowed."));
            return false;
        }
        if (origin != null) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        }
        if (!exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) return true;
        if (origin == null) {
            sendJson(exchange, 400, error("An origin is required for preflight requests."));
            return false;
        }
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "600");
        exchange.sendResponseHeaders(204, -1);
        exchange.close();
        return false;
    }

    private static Map<String, String> query(HttpExchange exchange) {
        return parseForm(exchange.getRequestURI().getRawQuery());
    }

    private static Map<String, String> readForm(HttpExchange exchange) throws IOException {
        byte[] bytes = exchange.getRequestBody().readAllBytes();
        if (bytes.length > 16_384) throw new IOException("Request body is too large.");
        return parseForm(new String(bytes, StandardCharsets.UTF_8));
    }

    private static Map<String, String> parseForm(String form) {
        Map<String, String> params = new HashMap<>();
        if (form == null || form.isEmpty()) return params;
        for (String pair : form.split("&")) {
            String[] entry = pair.split("=", 2);
            String key = URLDecoder.decode(entry[0], StandardCharsets.UTF_8);
            String value = entry.length == 2
                ? URLDecoder.decode(entry[1], StandardCharsets.UTF_8)
                : "";
            params.put(key, value);
        }
        return params;
    }

    private static void serveStatic(HttpExchange exchange) throws IOException {
        if (!methodIs(exchange, "GET")) return;
        String requested = exchange.getRequestURI().getPath();
        if (requested.equals("/")) requested = "/index.html";
        Path file = WEB_ROOT.resolve(requested.substring(1)).normalize();
        if (!file.startsWith(WEB_ROOT) || !Files.isRegularFile(file)) {
            sendText(exchange, 404, "Not found.", "text/plain; charset=utf-8");
            return;
        }
        String type = switch (file.getFileName().toString().substring(
            file.getFileName().toString().lastIndexOf('.') + 1
        )) {
            case "html" -> "text/html; charset=utf-8";
            case "css" -> "text/css; charset=utf-8";
            case "js" -> "text/javascript; charset=utf-8";
            case "jpg", "jpeg" -> "image/jpeg";
            default -> "application/octet-stream";
        };
        sendBytes(exchange, 200, Files.readAllBytes(file), type);
    }

    private static void databaseError(HttpExchange exchange, SQLException exception) throws IOException {
        exception.printStackTrace(System.err);
        sendJson(exchange, 500, error("Database error. Check that MySQL is running, the database has been set up, and DB_USER/DB_PASSWORD are correct."));
    }

    private static String error(String message) {
        return "{\"error\":" + quote(message) + "}";
    }

    private static String quote(String value) {
        StringBuilder json = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> json.append("\\\"");
                case '\\' -> json.append("\\\\");
                case '\b' -> json.append("\\b");
                case '\f' -> json.append("\\f");
                case '\n' -> json.append("\\n");
                case '\r' -> json.append("\\r");
                case '\t' -> json.append("\\t");
                default -> {
                    if (character < 0x20) {
                        json.append(String.format("\\u%04x", (int) character));
                    } else {
                        json.append(character);
                    }
                }
            }
        }
        return json.append('"').toString();
    }

    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        sendText(exchange, status, json, "application/json; charset=utf-8");
    }

    private static void sendText(HttpExchange exchange, int status, String body, String contentType)
        throws IOException {
        sendBytes(exchange, status, body.getBytes(StandardCharsets.UTF_8), contentType);
    }

    private static void sendBytes(HttpExchange exchange, int status, byte[] bytes, String contentType)
        throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private record Shift(LocalTime departure, LocalTime opens, LocalTime closes) { }

    private record DemoSeat(String routeNo, String shiftKey, int seat) { }

    private record BusTrip(
        long tripId,
        int capacity,
        boolean staffOnly,
        String destination,
        LocalTime opens,
        LocalTime closes
    ) { }
}
