import University from '../models/universityModel.js';

export const getUniversityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const university = await University.findById(id).select('name domain created_at');

    if (!university) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    res.json({
      success: true,
      data: {
        id: university._id,
        name: university.name,
        domain: university.domain
      }
    });
  } catch (error) {
    next(error);
  }
};
