package com.vc.learn.examples.chat.advisor;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClientMessageAggregator;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import org.springframework.ai.chat.prompt.PromptTemplate;

import reactor.core.publisher.Flux;

/**
 * 简单日志 advisor
 */
public class RereadingAdvisor implements CallAdvisor,StreamAdvisor{

    private final Logger logger = LoggerFactory.getLogger(this.getClass().getSimpleName());

    @Override
    public int getOrder() {
        return 2;
    }
    @Override
    public String getName() {
        return "SimpleLoggerAdvisor";
    }

    private static final String DEFAULT_RE2_ADVISE_TEMPLATE = """
            {re2_input_query}
            Read the question again: {re2_input_query}
            """;

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        request =logRequest(request);

        ChatClientResponse chatClientResponse = chain.nextCall(request); // 调用下一个 advisor,如果没有下一个 advisor,则调用Ai模型

        logResponse(chatClientResponse);

        return chatClientResponse;
    }
   @Override
	public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest,
			StreamAdvisorChain streamAdvisorChain) {
		chatClientRequest = logRequest(chatClientRequest);

		Flux<ChatClientResponse> chatClientResponses = streamAdvisorChain.nextStream(chatClientRequest);

		return new ChatClientMessageAggregator().aggregateChatClientResponse(chatClientResponses, this::logResponse);
	}

	private ChatClientRequest logRequest(ChatClientRequest request) {
        // 把用户问题再重新拼接在 提示词里
        String prompt = PromptTemplate.builder()
                .template(DEFAULT_RE2_ADVISE_TEMPLATE)
                .variables(Map.of("re2_input_query", request.prompt().getUserMessage().getText()))
                .build()
                .render();

        return request.mutate().prompt(request.prompt().augmentUserMessage(prompt)).build();
	}

	private void logResponse(ChatClientResponse chatClientResponse) {
		logger.info("response: {}", chatClientResponse);
	}


}
