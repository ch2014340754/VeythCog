package com.vc.llm.repository;

import com.vc.llm.entity.UserLlmBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserLlmBindingRepository extends JpaRepository<UserLlmBinding, Long> {

    List<UserLlmBinding> findByUserId(Long userId);

    /** 按绑定创建时间升序（对话页下拉顺序，spec 要求） */
    List<UserLlmBinding> findByUserIdOrderByCreateTimeAscIdAsc(Long userId);

    /** 某用户某供应商下的全部绑定（AK 为用户+供应商级，需整组读写） */
    List<UserLlmBinding> findByUserIdAndVendorCode(Long userId, String vendorCode);

    Optional<UserLlmBinding> findByUserIdAndVendorCodeAndModelCode(Long userId, String vendorCode, String modelCode);

    void deleteByUserIdAndVendorCodeAndModelCode(Long userId, String vendorCode, String modelCode);

    /** 某模型被多少条用户绑定引用（管理端删模型前的前置校验） */
    long countByVendorCodeAndModelCode(String vendorCode, String modelCode);

    /** 按 (vendor, model) 聚合绑定数：[vendorCode, modelCode, count] */
    @Query("select b.vendorCode, b.modelCode, count(b) from UserLlmBinding b group by b.vendorCode, b.modelCode")
    List<Object[]> countGroupedByVendorAndModel();
}
