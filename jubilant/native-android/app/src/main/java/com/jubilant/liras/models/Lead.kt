package com.jubilant.liras.models

import java.util.Date

data class Lead(
    val id: String,
    val name: String,
    val phone: String?,
    val company: String?,
    val location: String?,
    val status: String = "New",
    val loanAmount: Double = 0.0,
    val createdAt: Date = Date(),
    val nextFollowUp: Date?,
    val mediatorId: String = "3",
    val isHighPotential: Boolean = false,
    val notes: List<Note> = emptyList(),
    val documents: LeadDocuments = LeadDocuments(),
    val loanDetails: LoanDetails? = null
)

data class Note(
    val text: String,
    val date: Date = Date()
)

data class LeadDocuments(
    val kyc: Boolean = false,
    val itr: Boolean = false,
    val bank: Boolean = false,
    val tags: List<String> = emptyList()
)

data class LoanDetails(
    val principal: Double,
    val interest: Double,
    val netDisbursed: Double,
    val tenure: Int,
    val frequency: String,
    val rate: String,
    val paymentDate: Date?
)
