package com.ems.payroll.model;

import jakarta.persistence.*;

@Entity
@Table(name = "tax_brackets")
public class TaxBracket {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String tenantId;
    private String country;
    private String taxYear;
    private Double minIncome;
    private Double maxIncome;
    private Double rate;
    private Double flatAmount;
    private Integer bracketOrder;

    public TaxBracket() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getTaxYear() { return taxYear; }
    public void setTaxYear(String taxYear) { this.taxYear = taxYear; }
    public Double getMinIncome() { return minIncome; }
    public void setMinIncome(Double minIncome) { this.minIncome = minIncome; }
    public Double getMaxIncome() { return maxIncome; }
    public void setMaxIncome(Double maxIncome) { this.maxIncome = maxIncome; }
    public Double getRate() { return rate; }
    public void setRate(Double rate) { this.rate = rate; }
    public Double getFlatAmount() { return flatAmount; }
    public void setFlatAmount(Double flatAmount) { this.flatAmount = flatAmount; }
    public Integer getBracketOrder() { return bracketOrder; }
    public void setBracketOrder(Integer bracketOrder) { this.bracketOrder = bracketOrder; }
}
