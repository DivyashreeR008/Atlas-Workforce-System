package com.atlas.performance.repository;

import com.atlas.performance.model.Recognition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecognitionRepository extends JpaRepository<Recognition, String> {
    List<Recognition> findByTenantId(String tenantId);
    List<Recognition> findByTenantIdAndToEmployeeId(String tenantId, String toEmployeeId);
    List<Recognition> findByTenantIdAndFromEmployeeId(String tenantId, String fromEmployeeId);
    List<Recognition> findByTenantIdAndCategory(String tenantId, String category);
}
