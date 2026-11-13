package com.vc.admin.monitor.repository;

import com.vc.admin.monitor.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {

    boolean existsBySidAndStatus(String sid, String status);

    List<UserSession> findTop100ByStatusOrderByLastActiveAtDesc(String status);
}
