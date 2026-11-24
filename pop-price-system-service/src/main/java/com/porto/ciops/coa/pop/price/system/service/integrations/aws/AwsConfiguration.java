package com.porto.ciops.coa.pop.price.system.service.integrations.aws;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.retries.StandardRetryStrategy;
import software.amazon.awssdk.services.pricing.PricingClient;

import java.time.Duration;

/** Pricing endpoint region is independent of the product commercial region. */
@Configuration
public class AwsConfiguration {
    @Bean(destroyMethod = "close")
    DefaultCredentialsProvider awsCredentialsProvider() {
        return DefaultCredentialsProvider.builder().build();
    }

    @Bean(destroyMethod = "close")
    PricingClient pricingClient(
            @Value("${ratecard.aws.endpoint-region}") String endpointRegion,
            DefaultCredentialsProvider credentialsProvider) {
        return PricingClient.builder()
                .region(Region.of(endpointRegion))
                .credentialsProvider(credentialsProvider)
                .httpClientBuilder(
                        UrlConnectionHttpClient.builder()
                                .connectionTimeout(Duration.ofSeconds(5))
                                .socketTimeout(Duration.ofSeconds(30)))
                .overrideConfiguration(
                        c ->
                                c.apiCallTimeout(Duration.ofSeconds(90))
                                        .apiCallAttemptTimeout(Duration.ofSeconds(35))
                                        // Standard SDK retry includes exponential backoff and
                                        // jitter for transient/throttling errors.
                                        .retryStrategy(
                                                StandardRetryStrategy.builder()
                                                        .maxAttempts(4)
                                                        .build()))
                .build();
    }
}
