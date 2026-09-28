package com.vc.llm.repository;

import com.vc.llm.entity.LlmModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LlmModelRepository extends JpaRepository<LlmModel, Long> {

    Optional<LlmModel> findByVendorCodeAndModelCode(String vendorCode, String modelCode);

    List<LlmModel> findByEnabledTrue();

    List<LlmModel> findByVendorCodeAndEnabledTrue(String vendorCode);
}
