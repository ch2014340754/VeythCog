package com.vc.vcchat.llm.repository;

import com.vc.vcchat.llm.entity.UserLlmBinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserLlmBindingRepository extends JpaRepository<UserLlmBinding, Long> {

    List<UserLlmBinding> findByUserId(Long userId);

    Optional<UserLlmBinding> findByUserIdAndVendorCodeAndModelCode(Long userId, String vendorCode, String modelCode);

    void deleteByUserIdAndVendorCodeAndModelCode(Long userId, String vendorCode, String modelCode);
}
