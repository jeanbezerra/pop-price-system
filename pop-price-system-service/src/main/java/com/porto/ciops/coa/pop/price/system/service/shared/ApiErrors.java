package com.porto.ciops.coa.pop.price.system.service.shared;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Centralized errors never expose SQL, stack traces or AWS credentials. */
@RestControllerAdvice
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class ApiErrors {
    private static final Logger LOG = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail business(ApiException ex, HttpServletRequest request) {
        return problem(ex.status(), ex.getMessage(), request);
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        ConstraintViolationException.class,
        HandlerMethodValidationException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class,
        IllegalArgumentException.class
    })
    ProblemDetail validation(Exception ex, HttpServletRequest request) {
        var detail = problem(400, "Invalid parameters or payload", request);
        if (ex instanceof MethodArgumentNotValidException invalid) {
            detail.setProperty(
                    "violations",
                    invalid.getBindingResult().getFieldErrors().stream()
                            .map(e -> new Violation(e.getField(), e.getDefaultMessage()))
                            .toList());
        }
        return detail;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception ex, HttpServletRequest request) {
        if (ex instanceof org.springframework.web.ErrorResponse error)
            return problem(error.getStatusCode().value(), error.getBody().getDetail(), request);
        if (ex instanceof org.springframework.dao.TransientDataAccessException)
            return problem(
                    409,
                    "Concurrent change or temporary database contention; retry the request",
                    request);
        LOG.error("Request failed correlationId={}", request.getAttribute("correlationId"), ex);
        return problem(500, "Unable to process request", request);
    }

    private ProblemDetail problem(int status, String message, HttpServletRequest request) {
        var detail =
                ProblemDetail.forStatusAndDetail(
                        org.springframework.http.HttpStatusCode.valueOf(status), message);
        detail.setProperty("correlationId", request.getAttribute("correlationId"));
        return detail;
    }

    private record Violation(String field, String message) {}
}
