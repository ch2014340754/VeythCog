package com.vc.knowledge.handler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.postgresql.util.PGobject;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * String ↔ PostgreSQL {@code jsonb} 类型映射。
 * <p>仅用于 knowledge_doc.block_data 列（JSON 字符串），写时用 PGobject(type=jsonb) 提交，
 * 避免 JDBC 把字符串按 varchar 绑定导致 {@code column is of type jsonb but expression is of type character varying}。</p>
 * <p>注意：本类不加 @MappedTypes(String.class)，避免覆盖全局 String 类型映射；仅在实体字段上显式指定。</p>
 */
public class JsonbTypeHandler extends BaseTypeHandler<String> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType)
            throws SQLException {
        PGobject obj = new PGobject();
        obj.setType("jsonb");
        obj.setValue(parameter == null || parameter.isBlank() ? "[]" : parameter);
        ps.setObject(i, obj);
    }

    @Override
    public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return rs.getString(columnName);
    }

    @Override
    public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return rs.getString(columnIndex);
    }

    @Override
    public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return cs.getString(columnIndex);
    }
}
