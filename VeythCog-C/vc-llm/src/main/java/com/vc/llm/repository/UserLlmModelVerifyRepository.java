package com.vc.llm.repository;

import com.vc.llm.entity.UserLlmModelVerify;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserLlmModelVerifyRepository extends JpaRepository<UserLlmModelVerify, Long> {

    Optional<UserLlmModelVerify> findByUserIdAndVendorCodeAndModelCode(Long userId, String vendorCode, String modelCode);

    List<UserLlmModelVerify> findByUserId(Long userId);

    List<UserLlmModelVerify> findByUserIdAndVendorCode(Long userId, String vendorCode);
}
