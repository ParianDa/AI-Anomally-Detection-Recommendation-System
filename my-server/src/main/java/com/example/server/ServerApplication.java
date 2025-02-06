package com.example.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.*;
import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@RestController
@CrossOrigin // Enable CORS for all routes
public class ServerApplication {

    private static final String SCRIPT_PATH = Paths.get("server/process_anomalies.py").toAbsolutePath().toString();

    public static void main(String[] args) {
        SpringApplication.run(ServerApplication.class, args);
    }

    @PostMapping("/execute_script")
    public Map<String, String> executeScript(@RequestParam("file") MultipartFile file,
                                             @RequestParam("prompt") String prompt,
                                             @RequestParam("temperature") String temperature,
                                             @RequestParam("max_tokens") String maxTokens,
                                             @RequestParam("provider") String provider,
                                             @RequestParam("model") String model) {
        Map<String, String> response = new HashMap<>();
        String csvFilePath = null;

        try {
            if (!file.isEmpty()) {
                csvFilePath = saveUploadedFile(file);
            }
            String command = String.format("python %s \"%s\" \"%s\" %s %s %s", SCRIPT_PATH, csvFilePath, prompt, temperature, maxTokens, model);
            Process process = Runtime.getRuntime().exec(command);
            process.waitFor();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                StringBuilder stdout = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    stdout.append(line).append("\n");
                }
                response.put("stdout", stdout.toString());
            }
            

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                StringBuilder stderr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    stderr.append(line).append("\n");
                }
                response.put("stderr", stderr.toString());
            }
            System.out.println(response);

            if (csvFilePath != null) {
                Files.deleteIfExists(Paths.get(csvFilePath));
            }
        } catch (Exception e) {
            response.put("error", "exec error: " + e.getMessage());
        }

        return response;
    }

    @PostMapping("/get_recommendations")
    public Map<String, String> getRecommendations(@RequestParam("prompt") String prompt,
                                                  @RequestParam("temperature") String temperature,
                                                  @RequestParam("max_tokens") String maxTokens,
                                                  @RequestParam("provider") String provider,
                                                  @RequestParam("model") String model) {
        Map<String, String> response = new HashMap<>();
        String scriptPath = Paths.get("../process_anomalies.py").toAbsolutePath().toString(); // Ensure this is the correct path to your script

        try {
            String command = String.format("python %s \"follow-up\" \"%s\" %s %s %s", scriptPath, prompt, temperature, maxTokens, model);
            Process process = Runtime.getRuntime().exec(command);
            process.waitFor();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                StringBuilder stdout = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    stdout.append(line).append("\n");
                }
                response.put("stdout", stdout.toString());
            }
            System.out.println(response);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                StringBuilder stderr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    stderr.append(line).append("\n");
                }
                response.put("stderr", stderr.toString());
            }
        } catch (Exception e) {
            response.put("error", "exec error: " + e.getMessage());
        }

        return response;
    }

    private String saveUploadedFile(MultipartFile file) throws IOException {
        Path tempDir = Files.createTempDirectory("uploads");
        Path filePath = tempDir.resolve(file.getOriginalFilename());
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        return filePath.toAbsolutePath().toString();
    }
}
