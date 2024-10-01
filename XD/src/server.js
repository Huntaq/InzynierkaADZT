const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');


const app = express();
const port = 5000;


app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
  host: '34.116.229.68',
  user: 'root',
  password: 'QN|9YDTy[Tex3,04',
  database: 'inzynierka'
});

app.use(session({
  secret: '213314', // Replace with a unique key in production
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure only in production with HTTPS
}));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = results[0];

    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) {
        console.error('Password comparison error:', err);
        return res.status(500).json({ message: 'Error comparing passwords' });
      }

      if (result) {
        req.session.userId = user.id;
        res.json({
          message: 'Login successful',
          user: {
            username: user.username,
            age: user.age,
            gender: user.gender,
            is_banned: user.is_banned,
            email: user.email,
            profilePicture: user.profilePicture,
            posts: [] 
          },
        });
      } else {
        res.status(401).json({ message: 'Invalid username or password' });
      }
    });
  });
});


app.get('/api/posts', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  db.query('SELECT * FROM posts WHERE user_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching posts:', err);
      return res.status(500).json({ message: 'Error fetching posts from database' });
    }

    res.json(results);
  });
});


app.post('/api/posts', (req, res) => {
  const { route_id, content } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  db.query('INSERT INTO posts (user_id, route_id, content) VALUES (?, ?, ?)', 
    [userId, route_id, content], (err, result) => {
      if (err) {
        console.error('Error adding post:', err);
        return res.status(500).json({ message: 'Error adding post to the database' });
      }

      res.json({ message: 'Post added successfully' });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password, email, age, gender } = req.body;

  // Ensure gender is either 'F' or 'M'
  if (!['F', 'M'].includes(gender)) {
    return res.status(400).json({ message: 'Invalid gender value' });
  }

  // Ensure age is an integer
  const ageInt = parseInt(age, 10);
  if (!username || !password || !email || isNaN(ageInt) || !gender) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if username or email already exists
  db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      return res.status(409).json({ message: 'Username or email already taken' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Password hashing error:', err);
        return res.status(500).json({ message: 'Error hashing password' });
      }

      // Insert new user
      db.query('INSERT INTO users (username, password_hash, email, age, gender) VALUES (?, ?, ?, ?, ?)', 
        [username, hash, email, ageInt, gender], (err, result) => {
          if (err) {
            console.error('Error adding user to database:', err);
            return res.status(500).json({ message: 'Error adding user to database' });
          }

          res.json({ message: 'User registered successfully' });
      });
    });
  });
});


app.get('/api/events', (req, res) => {
  const query = 'SELECT id, title, description, type, distance, image FROM events';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching events:', err);
      return res.status(500).json({ message: 'Error fetching events from database' });
    }

    // Zwracamy wyniki jako JSON
    res.json(results);
  });
});
app.post('/api/friends', (req, res) => {
  const { user_id, friend_id } = req.body;

  // Sprawdź, czy zaproszenie do znajomych już istnieje
  db.query('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?', [user_id, friend_id], (err, results) => {
    if (err) {
      console.error('Error checking existing friendship:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: 'Friend request already sent or already friends' });
    }

    // Jeśli nie ma istniejącej znajomości, wstaw zaproszenie
    const query = 'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, "pending")';
    db.query(query, [user_id, friend_id], (err, result) => {
      if (err) {
        console.error('Error adding friend:', err);
        return res.status(500).json({ message: 'Error adding friend to database' });
      }

      res.json({ message: 'Friend request sent successfully' });
    });
  });
});

app.put('/api/friends/accept', (req, res) => {
  const { user_id, friend_id } = req.body;

  const query = 'UPDATE friends SET status = "accepted" WHERE user_id = ? AND friend_id = ? AND status = "pending"';
  db.query(query, [friend_id, user_id], (err, result) => {
    if (err) {
      console.error('Error accepting friend request:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'No pending friend request found' });
    }

    res.json({ message: 'Friend request accepted successfully' });
  });
});

app.put('/api/friends/reject', (req, res) => {
  const { user_id, friend_id } = req.body;

  const query = 'UPDATE friends SET status = "rejected" WHERE user_id = ? AND friend_id = ? AND status = "pending"';
  db.query(query, [friend_id, user_id], (err, result) => {
    if (err) {
      console.error('Error rejecting friend request:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'No pending friend request found' });
    }

    res.json({ message: 'Friend request rejected successfully' });
  });
});
app.get('/api/friends/:user_id', (req, res) => {
  const { user_id } = req.params;

  const query = `
    SELECT u.id, u.username, u.email, f.status 
    FROM users u 
    JOIN friends f ON (u.id = f.friend_id OR u.id = f.user_id)
    WHERE (f.user_id = ? OR f.friend_id = ?) 
      AND f.status = "accepted" 
      AND u.id != ?
  `;

  console.log('User ID:', user_id);
  console.log('Query:', query);
  console.log('Parameters:', [user_id, user_id, user_id]);

  db.query(query, [user_id, user_id, user_id], (err, results) => {
    if (err) {
      console.error('Error fetching friends:', err);
      return res.status(500).json({ message: 'Error fetching friends from database' });
    }

    console.log('Friends results:', results);
    res.json(results);
  });
});





app.post('/api/routes', (req, res) => {
  const {
    user_id,
    transport_mode_id,
    distance_km,
    CO2,
    kcal,
    duration,
    money,
    is_private
  } = req.body;

  if (!user_id || !transport_mode_id || !distance_km ||  !CO2 || !kcal || !duration || !money === undefined || is_private === undefined) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query(
    'INSERT INTO user_routes (user_id, transport_mode_id, distance_km,  CO2, kcal, duration, money, is_private) VALUES (?,  ?, ?, ?, ?, ?, ?, ?)',
    [user_id, transport_mode_id, distance_km,  CO2, kcal, duration, money, is_private],
    (err, result) => {
      if (err) {
        console.error('Error adding route:', err);
        return res.status(500).json({ message: 'Error adding route to the database' });
      }

      res.json({ message: 'Route added successfully', routeId: result.insertId });
    }
  );
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});




