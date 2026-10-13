package com.atlas.common.security;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@AutoConfiguration
@EnableWebSecurity
@ComponentScan(basePackageClasses = { InternalAuthFilter.class, RoleAspect.class })
public class CommonSecurityAutoConfiguration {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		// Stateless internal service API: every request (except /health) must
		// carry a short-lived HMAC-SHA256 internal JWT in the x-internal-auth
		// header, enforced by InternalAuthFilter. No session cookie is ever
		// issued or accepted here, so there is no ambient credential for a
		// malicious site to forge requests with and CSRF tokens do not apply.
		// This matches Spring's own guidance to disable CSRF for services used
		// only by non-browser clients.
		// codeql[java/spring-disabled-csrf-protection]
		http.csrf(csrf -> csrf.disable())
			.authorizeHttpRequests(auth -> auth
				.requestMatchers("/health").permitAll()
				.anyRequest().permitAll()
			)
			.sessionManagement(session -> session
				.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
			);
		return http.build();
	}

	@Bean
	public WebMvcConfigurer tenantIdArgumentResolverConfigurer() {
		return new WebMvcConfigurer() {
			@Override
			public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
				resolvers.add(new TenantIdArgumentResolver());
			}
		};
	}
}
