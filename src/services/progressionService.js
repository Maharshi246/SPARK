import EngagementEvent from '../models/engagementEventModel.js';
import User from '../models/userModel.js';
import { progressionRules } from '../config/progressionRules.js';

export const getCurrentStage = async (userId) => {
  const user = await User.findById(userId).select('current_stage');
  return user?.current_stage || 'stage_1';
};

export const calculateProgress = async (userId) => {
  const currentStage = await getCurrentStage(userId);

  // If already at max stage, return 100%
  if (currentStage === 'stage_5') {
    return {
      currentStage,
      progressPercentage: 100,
      requirements: { nextStage: null, status: 'maxed' }
    };
  }

  // Determine next stage rule key
  const stageNumber = parseInt(currentStage.split('_')[1]);
  const ruleKey = `stage_${stageNumber}_to_${stageNumber + 1}`;
  const rule = progressionRules[ruleKey];

  if (!rule || !rule.enabled) {
    return {
      currentStage,
      progressPercentage: 0,
      requirements: { nextStage: null, status: 'disabled' }
    };
  }

  // Fetch engagement metrics
  const messagesCount = await EngagementEvent.countDocuments({
    user_id: userId,
    event_type: 'message_sent'
  });

  const sessionsCount = await EngagementEvent.countDocuments({
    user_id: userId,
    event_type: 'session_start'
  });

  const msgProgress = Math.min((messagesCount / rule.minMessages) * 100, 100);
  const sessionProgress = Math.min((sessionsCount / rule.minSessions) * 100, 100);
  
  const overallProgress = Math.floor((msgProgress + sessionProgress) / 2);

  return {
    currentStage,
    progressPercentage: overallProgress,
    requirements: {
      nextStage: `stage_${stageNumber + 1}`,
      metrics: {
        messages: { current: messagesCount, required: rule.minMessages },
        sessions: { current: sessionsCount, required: rule.minSessions }
      }
    }
  };
};

export const checkPromotionEligibility = async (userId) => {
  const progress = await calculateProgress(userId);
  return progress.progressPercentage >= 100;
};
