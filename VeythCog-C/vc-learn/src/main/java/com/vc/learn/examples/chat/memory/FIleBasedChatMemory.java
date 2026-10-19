package com.vc.learn.examples.chat.memory;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.objenesis.strategy.StdInstantiatorStrategy;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;

import com.esotericsoftware.kryo.Kryo;
import com.esotericsoftware.kryo.io.Input;
import com.esotericsoftware.kryo.io.Output;

/**
 * 基于文件的 ChatMemory 实现
 * FIleBasedChatMemory
 */
public class FIleBasedChatMemory implements ChatMemory {

    // 保存消息文件总文件夹地址
    private static final String MESSAGE_FILE_FOLDER = ".temp/messages";
    // 消息文件后缀
    private static final String MESSAGE_FILE_SUFFIX = ".kryo";
    // 消息文件前缀
    private static final String MESSAGE_FILE_PREFIX = "message_";
    // kryo 序列化工具
    private static final Kryo kryo = new Kryo();

    static {
        // 取消手动注册
        kryo.setRegistrationRequired(false);
        // 设置实例化策略
        kryo.setInstantiatorStrategy(new StdInstantiatorStrategy()); // 使用反射创建实例

        // 构建文件夹
        File folder = new File(MESSAGE_FILE_FOLDER);
        if (!folder.exists()) {
            folder.mkdirs();
        }
    }

    // 根据会话ID获取消息文件路径
    private String getMessageFilePath(String conversationId) {
        return MESSAGE_FILE_FOLDER + File.separator + MESSAGE_FILE_PREFIX + conversationId + MESSAGE_FILE_SUFFIX;
    }

    // 根据会话ID创建或获取会话
    private List<Message> createOrGetConversationFile(String conversationId) {
        File file = new File(getMessageFilePath(conversationId));
        List<Message> messages = new ArrayList<>();
        try {
            // 文件不存在或为空时，直接返回空列表，避免 Kryo 从空缓冲区读取导致 BufferUnderflow
            if (!file.exists() || file.length() == 0) {
                return messages;
            }
            try (Input fis = new Input(new FileInputStream(file))) {
                messages = kryo.readObject(fis, ArrayList.class);
            }

        } catch (IOException e) {

            throw new RuntimeException("Failed to create or get conversation file", e);
        }
        return messages;
    }

    // 保存会话
    private void saveConversationFile(String conversationId, List<Message> messages) {
        File file = new File(getMessageFilePath(conversationId));
        // 确保父目录存在
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        try (Output fos = new Output(new FileOutputStream(file))) {
            kryo.writeObject(fos, messages);
        } catch (IOException e) {
            throw new RuntimeException(e.getMessage(), e);
        }
    }

    // 添加消息到会话
    @Override
    public void add(String conversationId, List<Message> messages) {
        // 合并消息
        List<Message> existingMessages = createOrGetConversationFile(conversationId);
        existingMessages.addAll(messages);
        saveConversationFile(conversationId, existingMessages);
    }

    // 获取会话
    @Override
    public List<Message> get(String conversationId) {
        return createOrGetConversationFile(conversationId);
    }

    // 获取会话最近 n 条消息
    public List<Message> getLastN(String conversationId, int n) {
        List<Message> messages = createOrGetConversationFile(conversationId);
        // 确保 n 不超过消息数量
        if (n > messages.size()) {
            n = messages.size();
        }
        return messages.subList(messages.size() - n, messages.size());
    }

    // 清空会话
    @Override
    public void clear(String conversationId) {
        File file = new File(getMessageFilePath(conversationId));
        if (file.exists()) {
            file.delete();
        }
    }

}