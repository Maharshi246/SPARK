import EnrollmentToken from '../models/enrollmentTokenModel.js';
import University from '../models/universityModel.js';

export const generateToken = async (req, res, next) => {
  try {
    const user = req.user;
    let universityId = user.university_id;

    // If admin, they can provide a universityId in the body
    if (user.role === 'admin' && req.body.universityId) {
      const uni = await University.findById(req.body.universityId);
      if (!uni) {
        return res.status(404).json({ success: false, message: 'University not found' });
      }
      universityId = uni._id;
    }

    if (!universityId) {
      return res.status(400).json({ success: false, message: 'No university associated with this manager. Admin must specify universityId.' });
    }

    const tokenDoc = await EnrollmentToken.create({
      university_id: universityId,
      created_by: user._id
    });

    res.status(201).json({ success: true, token: tokenDoc.token });
  } catch (error) {
    next(error);
  }
};
