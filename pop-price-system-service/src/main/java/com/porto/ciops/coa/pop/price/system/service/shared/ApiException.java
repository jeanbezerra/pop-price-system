package com.porto.ciops.coa.pop.price.system.service.shared;

/** Safe business error, translated into HTTP Problem Details at the API boundary. */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }

    public static ApiException missing(String resource) {
        return new ApiException(404, resource + " not found");
    }
}
