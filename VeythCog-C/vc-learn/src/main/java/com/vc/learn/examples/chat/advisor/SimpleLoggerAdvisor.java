package com.vc.learn.examples.chat.advisor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClientMessageAggregator;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;

import reactor.core.publisher.Flux;

/**
 * 简单日志 advisor
 */
public class SimpleLoggerAdvisor implements CallAdvisor,StreamAdvisor{

    private static final Logger logger = LoggerFactory.getLogger(SimpleLoggerAdvisor.class);

    @Override
    public int getOrder() {
        return 10;
    }
    @Override
    public String getName() {
        return "SimpleLoggerAdvisor";
    }
    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        logRequest(request);

        ChatClientResponse chatClientResponse = chain.nextCall(request); // 调用下一个 advisor,如果没有下一个 advisor,则调用Ai模型

        logResponse(chatClientResponse);

        return chatClientResponse;
    }
   @Override
	public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest,
			StreamAdvisorChain streamAdvisorChain) {
		logRequest(chatClientRequest);

		Flux<ChatClientResponse> chatClientResponses = streamAdvisorChain.nextStream(chatClientRequest);

		return new ChatClientMessageAggregator().aggregateChatClientResponse(chatClientResponses, this::logResponse);
	}

	private void logRequest(ChatClientRequest request) {
		logger.info("request: {}", request);
	}

	private void logResponse(ChatClientResponse chatClientResponse) {
		logger.info("response: {}", chatClientResponse);
	}


}
