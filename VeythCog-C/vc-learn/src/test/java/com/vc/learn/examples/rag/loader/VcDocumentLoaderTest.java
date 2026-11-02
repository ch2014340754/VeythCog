package com.vc.learn.examples.rag.loader;

import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.util.List;

@SpringBootTest
public class VcDocumentLoaderTest {

    @Autowired
    private ResourcePatternResolver resourcePatternResolver;

    @Test
    void testLoadMarkdowns() {
        VcDocumentLoader vcDocumentLoader = new VcDocumentLoader(resourcePatternResolver);
        List<Document> documents = vcDocumentLoader.loadMarkdowns();
        System.out.println(documents);
    }
}
