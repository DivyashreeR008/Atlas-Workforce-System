package com.atlas.performance.service;

import com.atlas.performance.model.*;
import com.atlas.performance.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class PerformanceService {

    private final GoalRepository goalRepository;
    private final PerformanceReviewRepository reviewRepository;
    private final Feedback360Repository feedbackRepository;
    private final SuccessionPlanRepository successionPlanRepository;
    private final SuccessionCandidateRepository successionCandidateRepository;
    private final RecognitionRepository recognitionRepository;

    public PerformanceService(GoalRepository goalRepository,
                              PerformanceReviewRepository reviewRepository,
                              Feedback360Repository feedbackRepository,
                              SuccessionPlanRepository successionPlanRepository,
                              SuccessionCandidateRepository successionCandidateRepository,
                              RecognitionRepository recognitionRepository) {
        this.goalRepository = goalRepository;
        this.reviewRepository = reviewRepository;
        this.feedbackRepository = feedbackRepository;
        this.successionPlanRepository = successionPlanRepository;
        this.successionCandidateRepository = successionCandidateRepository;
        this.recognitionRepository = recognitionRepository;
    }

    // ---- Goals ----

    public List<Goal> getGoals(String tenantId, String employeeId, String status, String category) {
        if (employeeId != null) {
            if (status != null) return goalRepository.findByTenantIdAndEmployeeIdAndStatus(tenantId, employeeId, status);
            return goalRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
        }
        if (status != null) return goalRepository.findByTenantIdAndStatus(tenantId, status);
        if (category != null) return goalRepository.findByTenantIdAndCategory(tenantId, category);
        return goalRepository.findByTenantId(tenantId);
    }

    public Goal getGoal(String tenantId, String id) {
        return goalRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Goal not found"));
    }

    @Transactional
    public Goal createGoal(String tenantId, Goal goal) {
        goal.setTenantId(tenantId);
        if (goal.getProgressPct() == null) goal.setProgressPct(BigDecimal.ZERO);
        if (goal.getStatus() == null) goal.setStatus("DRAFT");
        return goalRepository.save(goal);
    }

    @Transactional
    public Goal updateGoal(String tenantId, String id, Goal updated) {
        Goal goal = getGoal(tenantId, id);
        if (updated.getTitle() != null) goal.setTitle(updated.getTitle());
        if (updated.getDescription() != null) goal.setDescription(updated.getDescription());
        if (updated.getGoalType() != null) goal.setGoalType(updated.getGoalType());
        if (updated.getCategory() != null) goal.setCategory(updated.getCategory());
        if (updated.getStartDate() != null) goal.setStartDate(updated.getStartDate());
        if (updated.getEndDate() != null) goal.setEndDate(updated.getEndDate());
        if (updated.getKeyResults() != null) goal.setKeyResults(updated.getKeyResults());
        return goalRepository.save(goal);
    }

    @Transactional
    public void deleteGoal(String tenantId, String id) {
        Goal goal = getGoal(tenantId, id);
        goalRepository.delete(goal);
    }

    @Transactional
    public Goal updateGoalProgress(String tenantId, String id, BigDecimal progressPct, String keyResults) {
        Goal goal = getGoal(tenantId, id);
        if (progressPct != null) {
            if (progressPct.compareTo(BigDecimal.ZERO) < 0 || progressPct.compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new IllegalArgumentException("Progress must be between 0 and 100");
            }
            goal.setProgressPct(progressPct);
        }
        if (keyResults != null) goal.setKeyResults(keyResults);
        return goalRepository.save(goal);
    }

    @Transactional
    public Goal updateGoalStatus(String tenantId, String id, String status) {
        Goal goal = getGoal(tenantId, id);
        String upper = status.toUpperCase();
        Set<String> valid = Set.of("DRAFT", "ACTIVE", "COMPLETED", "CANCELLED");
        if (!valid.contains(upper)) {
            throw new IllegalArgumentException("Invalid status. Must be DRAFT, ACTIVE, COMPLETED, or CANCELLED");
        }
        goal.setStatus(upper);
        if ("COMPLETED".equals(upper)) goal.setProgressPct(BigDecimal.valueOf(100));
        return goalRepository.save(goal);
    }

    // ---- Performance Reviews ----

    public List<PerformanceReview> getReviews(String tenantId, String employeeId, String reviewerId, String status, String cycle) {
        if (employeeId != null) return reviewRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
        if (reviewerId != null) return reviewRepository.findByTenantIdAndReviewerId(tenantId, reviewerId);
        if (status != null) return reviewRepository.findByTenantIdAndStatus(tenantId, status);
        if (cycle != null) return reviewRepository.findByTenantIdAndReviewCycle(tenantId, cycle);
        return reviewRepository.findByTenantId(tenantId);
    }

    public PerformanceReview getReview(String tenantId, String id) {
        return reviewRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));
    }

    @Transactional
    public PerformanceReview createReview(String tenantId, PerformanceReview review) {
        review.setTenantId(tenantId);
        if (review.getStatus() == null) review.setStatus("PENDING");
        return reviewRepository.save(review);
    }

    @Transactional
    public PerformanceReview updateReview(String tenantId, String id, PerformanceReview updated) {
        PerformanceReview review = getReview(tenantId, id);
        if (updated.getReviewerId() != null) review.setReviewerId(updated.getReviewerId());
        if (updated.getDueDate() != null) review.setDueDate(updated.getDueDate());
        if (updated.getOverallRating() != null) review.setOverallRating(updated.getOverallRating());
        if (updated.getStrengths() != null) review.setStrengths(updated.getStrengths());
        if (updated.getAreasForImprovement() != null) review.setAreasForImprovement(updated.getAreasForImprovement());
        if (updated.getComments() != null) review.setComments(updated.getComments());
        if (updated.getScores() != null) review.setScores(updated.getScores());
        return reviewRepository.save(review);
    }

    @Transactional
    public PerformanceReview submitReview(String tenantId, String id) {
        PerformanceReview review = getReview(tenantId, id);
        review.setStatus("COMPLETED");
        review.setCompletedDate(LocalDateTime.now());
        return reviewRepository.save(review);
    }

    @Transactional
    public PerformanceReview acknowledgeReview(String tenantId, String id) {
        PerformanceReview review = getReview(tenantId, id);
        if (!"COMPLETED".equals(review.getStatus())) {
            throw new IllegalArgumentException("Review must be COMPLETED before acknowledging");
        }
        review.setStatus("ACKNOWLEDGED");
        return reviewRepository.save(review);
    }

    public List<PerformanceReview> getReviewsByCycle(String tenantId, String cycle) {
        return reviewRepository.findByTenantIdAndReviewCycle(tenantId, cycle);
    }

    public List<PerformanceReview> getReviewHistory(String tenantId, String employeeId) {
        return reviewRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
    }

    // ---- 360 Feedback ----

    public List<Feedback360> getFeedbackList(String tenantId, String employeeId, String reviewerId) {
        if (employeeId != null) return feedbackRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
        if (reviewerId != null) return feedbackRepository.findByTenantIdAndReviewerId(tenantId, reviewerId);
        return feedbackRepository.findByTenantId(tenantId);
    }

    public Feedback360 getFeedback(String tenantId, String id) {
        return feedbackRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Feedback not found"));
    }

    @Transactional
    public Feedback360 submitFeedback(String tenantId, Feedback360 feedback) {
        feedback.setTenantId(tenantId);
        if (feedback.getStatus() == null) feedback.setStatus("SUBMITTED");
        if (feedback.getIsConfidential() == null) feedback.setIsConfidential(false);
        return feedbackRepository.save(feedback);
    }

    public Map<String, Object> getFeedbackSummary(String tenantId, String employeeId) {
        List<Feedback360> feedbacks = feedbackRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("employeeId", employeeId);
        summary.put("totalFeedback", feedbacks.size());

        if (feedbacks.isEmpty()) {
            summary.put("averageRating", null);
            summary.put("categoryAverages", Collections.emptyMap());
            summary.put("relationshipBreakdown", Collections.emptyMap());
            return summary;
        }

        BigDecimal totalRating = BigDecimal.ZERO;
        int ratingCount = 0;
        Map<String, List<BigDecimal>> categoryRatings = new LinkedHashMap<>();
        Map<String, Integer> relationshipCount = new LinkedHashMap<>();

        for (Feedback360 fb : feedbacks) {
            if (fb.getRating() != null) {
                totalRating = totalRating.add(fb.getRating());
                ratingCount++;
            }
            if (fb.getRelationship() != null) {
                relationshipCount.merge(fb.getRelationship(), 1, Integer::sum);
            }
            if (fb.getCategories() != null && !fb.getCategories().isEmpty()) {
                // categories stored as JSON string - skip complex parsing here
            }
        }

        summary.put("averageRating", ratingCount > 0 ? totalRating.divide(BigDecimal.valueOf(ratingCount), 2, RoundingMode.HALF_UP) : null);
        summary.put("relationshipBreakdown", relationshipCount);

        Map<String, BigDecimal> avgCategories = new LinkedHashMap<>();
        for (Map.Entry<String, List<BigDecimal>> entry : categoryRatings.entrySet()) {
            BigDecimal sum = entry.getValue().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            avgCategories.put(entry.getKey(), sum.divide(BigDecimal.valueOf(entry.getValue().size()), 2, RoundingMode.HALF_UP));
        }
        summary.put("categoryAverages", avgCategories);

        return summary;
    }

    // ---- Succession Plans ----

    public List<SuccessionPlan> getSuccessionPlans(String tenantId, String department, String status) {
        if (department != null) return successionPlanRepository.findByTenantIdAndDepartment(tenantId, department);
        if (status != null) return successionPlanRepository.findByTenantIdAndStatus(tenantId, status);
        return successionPlanRepository.findByTenantId(tenantId);
    }

    public Map<String, Object> getSuccessionPlanWithCandidates(String tenantId, String id) {
        SuccessionPlan plan = successionPlanRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Succession plan not found"));
        List<SuccessionCandidate> candidates = successionCandidateRepository.findByTenantIdAndPlanId(tenantId, id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plan", plan);
        result.put("candidates", candidates);
        return result;
    }

    @Transactional
    public SuccessionPlan createSuccessionPlan(String tenantId, SuccessionPlan plan) {
        plan.setTenantId(tenantId);
        if (plan.getStatus() == null) plan.setStatus("ACTIVE");
        return successionPlanRepository.save(plan);
    }

    @Transactional
    public SuccessionPlan updateSuccessionPlan(String tenantId, String id, SuccessionPlan updated) {
        SuccessionPlan plan = successionPlanRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Succession plan not found"));
        if (updated.getPosition() != null) plan.setPosition(updated.getPosition());
        if (updated.getDepartment() != null) plan.setDepartment(updated.getDepartment());
        if (updated.getCurrentHolderId() != null) plan.setCurrentHolderId(updated.getCurrentHolderId());
        if (updated.getReadiness() != null) plan.setReadiness(updated.getReadiness());
        if (updated.getRiskOfLoss() != null) plan.setRiskOfLoss(updated.getRiskOfLoss());
        if (updated.getStatus() != null) plan.setStatus(updated.getStatus());
        return successionPlanRepository.save(plan);
    }

    @Transactional
    public void deleteSuccessionPlan(String tenantId, String id) {
        SuccessionPlan plan = successionPlanRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Succession plan not found"));
        List<SuccessionCandidate> candidates = successionCandidateRepository.findByTenantIdAndPlanId(tenantId, id);
        successionCandidateRepository.deleteAll(candidates);
        successionPlanRepository.delete(plan);
    }

    // ---- Succession Candidates ----

    @Transactional
    public SuccessionCandidate addCandidate(String tenantId, SuccessionCandidate candidate) {
        candidate.setTenantId(tenantId);
        if (candidate.getStatus() == null) candidate.setStatus("IDENTIFIED");
        return successionCandidateRepository.save(candidate);
    }

    @Transactional
    public SuccessionCandidate updateCandidate(String tenantId, String id, SuccessionCandidate updated) {
        SuccessionCandidate candidate = successionCandidateRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
        if (updated.getReadinessScore() != null) candidate.setReadinessScore(updated.getReadinessScore());
        if (updated.getRanking() != null) candidate.setRanking(updated.getRanking());
        if (updated.getDevelopmentPlan() != null) candidate.setDevelopmentPlan(updated.getDevelopmentPlan());
        if (updated.getStrengths() != null) candidate.setStrengths(updated.getStrengths());
        if (updated.getGaps() != null) candidate.setGaps(updated.getGaps());
        if (updated.getStatus() != null) candidate.setStatus(updated.getStatus());
        return successionCandidateRepository.save(candidate);
    }

    @Transactional
    public void removeCandidate(String tenantId, String id) {
        SuccessionCandidate candidate = successionCandidateRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
        successionCandidateRepository.delete(candidate);
    }

    public List<SuccessionCandidate> getEmployeeReadiness(String tenantId, String employeeId) {
        return successionCandidateRepository.findByTenantIdAndEmployeeId(tenantId, employeeId);
    }

    // ---- Recognitions ----

    public List<Recognition> getRecognitions(String tenantId, String employeeId, String category) {
        if (employeeId != null) return recognitionRepository.findByTenantIdAndToEmployeeId(tenantId, employeeId);
        if (category != null) return recognitionRepository.findByTenantIdAndCategory(tenantId, category);
        return recognitionRepository.findByTenantId(tenantId);
    }

    @Transactional
    public Recognition giveRecognition(String tenantId, Recognition recognition) {
        recognition.setTenantId(tenantId);
        if (recognition.getPoints() == null) recognition.setPoints(1);
        return recognitionRepository.save(recognition);
    }

    public List<Recognition> getRecognitionWall(String tenantId) {
        return recognitionRepository.findByTenantId(tenantId);
    }

    // ---- Analytics ----

    public Map<String, Object> getAnalyticsOverview(String tenantId) {
        Map<String, Object> overview = new LinkedHashMap<>();

        List<PerformanceReview> allReviews = reviewRepository.findByTenantId(tenantId);
        List<Goal> allGoals = goalRepository.findByTenantId(tenantId);
        List<Feedback360> allFeedback = feedbackRepository.findByTenantId(tenantId);

        BigDecimal avgRating = null;
        if (!allReviews.isEmpty()) {
            BigDecimal sum = BigDecimal.ZERO;
            int count = 0;
            for (PerformanceReview r : allReviews) {
                if (r.getOverallRating() != null) {
                    sum = sum.add(r.getOverallRating());
                    count++;
                }
            }
            if (count > 0) avgRating = sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        }

        long goalsCompleted = allGoals.stream().filter(g -> "COMPLETED".equals(g.getStatus())).count();
        long goalsActive = allGoals.stream().filter(g -> "ACTIVE".equals(g.getStatus())).count();

        overview.put("averageRating", avgRating);
        overview.put("totalReviews", allReviews.size());
        overview.put("totalGoals", allGoals.size());
        overview.put("goalsCompleted", goalsCompleted);
        overview.put("goalsActive", goalsActive);
        overview.put("totalFeedbackSubmissions", allFeedback.size());

        return overview;
    }

    public Map<String, Object> getDepartmentRatings(String tenantId) {
        List<PerformanceReview> allReviews = reviewRepository.findByTenantId(tenantId);
        Map<String, List<BigDecimal>> deptRatings = new LinkedHashMap<>();

        for (PerformanceReview r : allReviews) {
            if (r.getOverallRating() != null) {
                String dept = "Unknown";
                deptRatings.computeIfAbsent(dept, k -> new ArrayList<>()).add(r.getOverallRating());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<String, List<BigDecimal>> entry : deptRatings.entrySet()) {
            BigDecimal sum = entry.getValue().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avg = sum.divide(BigDecimal.valueOf(entry.getValue().size()), 2, RoundingMode.HALF_UP);
            result.put(entry.getKey(), avg);
        }
        return result;
    }

    public Map<String, Object> getGoalCompletionRates(String tenantId) {
        List<Goal> allGoals = goalRepository.findByTenantId(tenantId);
        long total = allGoals.size();
        long completed = allGoals.stream().filter(g -> "COMPLETED".equals(g.getStatus())).count();
        long active = allGoals.stream().filter(g -> "ACTIVE".equals(g.getStatus())).count();
        long draft = allGoals.stream().filter(g -> "DRAFT".equals(g.getStatus())).count();
        long cancelled = allGoals.stream().filter(g -> "CANCELLED".equals(g.getStatus())).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalGoals", total);
        result.put("completed", completed);
        result.put("active", active);
        result.put("draft", draft);
        result.put("cancelled", cancelled);
        result.put("completionRate", total > 0 ? BigDecimal.valueOf(completed).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        return result;
    }

    public Map<String, Object> getSuccessionReadiness(String tenantId) {
        List<SuccessionPlan> plans = successionPlanRepository.findByTenantId(tenantId);
        List<SuccessionCandidate> candidates = successionCandidateRepository.findByTenantId(tenantId);

        long immediate = candidates.stream().filter(c -> c.getReadinessScore() != null && c.getReadinessScore().compareTo(BigDecimal.valueOf(80)) >= 0).count();
        long sixMonths = candidates.stream().filter(c -> c.getReadinessScore() != null && c.getReadinessScore().compareTo(BigDecimal.valueOf(60)) >= 0 && c.getReadinessScore().compareTo(BigDecimal.valueOf(80)) < 0).count();
        long oneYear = candidates.stream().filter(c -> c.getReadinessScore() != null && c.getReadinessScore().compareTo(BigDecimal.valueOf(40)) >= 0 && c.getReadinessScore().compareTo(BigDecimal.valueOf(60)) < 0).count();
        long notReady = candidates.stream().filter(c -> c.getReadinessScore() == null || c.getReadinessScore().compareTo(BigDecimal.valueOf(40)) < 0).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalPlans", plans.size());
        result.put("totalCandidates", candidates.size());
        result.put("immediate", immediate);
        result.put("sixMonths", sixMonths);
        result.put("oneYear", oneYear);
        result.put("notReady", notReady);
        return result;
    }
}
