const recogniseRole = (req, _, next) => {
  if (!req.token) {
    console.error(`Can't find token object`);
    req.role = 'student';
    throw new Error(`Can't find token object`);
  }
  if (req.token.counsellor === true) {
    req.role = 'counsellor';
    next();
  } else {
    req.role = 'student';
    next();
  }
};

module.exports = recogniseRole;
