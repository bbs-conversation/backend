const counsellors = require('../config/counsellors.json');

const recogniseRole = (req, _, next) => {
  if (!counsellors) {
    req.role === 'student';
    next();
  }
  if (!req.token) {
    console.error(`Can't find token object`);
    req.role === 'student';
    next();
  }
  if (counsellors.includes(req.token.user_id)) {
    req.role === 'counsellor';
    next();
  } else {
    req.role === 'student';
    next();
  }
};

module.exports = recogniseRole;
