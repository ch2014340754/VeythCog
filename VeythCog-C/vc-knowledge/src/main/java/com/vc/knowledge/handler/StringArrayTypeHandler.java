package com.vc.knowledge.handler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.Array;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * String[] ↔ PostgreSQL {@code text[]} 类型映射。
 * <p>用于 knowledge_doc.tags 数组列；写用 JDBC {@code createArrayOf("text", ...)}，
 * 读用 {@code ResultSet.getArray(...)} 解包。</p>
 */
@MappedTypes(String[].class)
@MappedJdbcTypes(JdbcType.ARRAY)
public class StringArrayTypeHandler extends BaseTypeHandler<String[]> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String[] parameter, JdbcType jdbcType)
            throws SQLException {
        Array array = ps.getConnection().createArrayOf("text", parameter);
        ps.setArray(i, array);
    }

    @Override
    public String[] getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toArray(rs.getArray(columnName));
    }

    @Override
    public String[] getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toArray(rs.getArray(columnIndex));
    }

    @Override
    public String[] getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toArray(cs.getArray(columnIndex));
    }

    private String[] toArray(Array array) throws SQLException {
        if (array == null) {
            return new String[0];
        }
        Object raw = array.getArray();
        if (raw instanceof String[] strings) {
            return strings;
        }
        if (raw instanceof Object[] objects) {
            String[] out = new String[objects.length];
            for (int i = 0; i < objects.length; i++) {
                out[i] = objects[i] == null ? "" : objects[i].toString();
            }
            return out;
        }
        return new String[0];
    }
}
