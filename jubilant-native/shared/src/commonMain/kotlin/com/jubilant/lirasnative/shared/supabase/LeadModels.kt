package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LeadSummary(
  val id: String,
  @SerialName("owner_id")
  val ownerId: String? = null,
  @SerialName("created_by")
  val createdBy: String? = null,
  val name: String,
  val company: String? = null,
  val phone: String? = null,
  val location: String? = null,
  val status: String? = null,
  @SerialName("loan_amount")
  val loanAmount: Long? = null,
  @SerialName("next_follow_up")
  val nextFollowUp: String? = null,
  @SerialName("mediator_id")
  val mediatorId: String? = null,
  @SerialName("is_high_potential")
  val isHighPotential: Boolean? = null,
  @SerialName("assigned_staff")
  val assignedStaff: String? = null,
  val documents: LeadDocuments? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
)

@Serializable
data class LeadDocuments(
  val kyc: Boolean = false,
  val itr: Boolean = false,
  val bank: Boolean = false,
)

@Serializable
data class LeadNote(
  val text: String,
  val date: String,
  @SerialName("by")
  val byUser: String? = null,
)

@Serializable
data class LoanDetails(
  val principal: Long? = null,
  val interest: Long? = null,
  @SerialName("netDisbursed")
  val netDisbursed: Long? = null,
  val tenure: Int? = null,
  val frequency: String? = null,
  val rate: String? = null,
  val paymentDate: String? = null,
  @SerialName("commissionAmount")
  val commissionAmount: Long? = null,
)

@Serializable
data class RejectionDetails(
  val strategy: String? = null,
  val reason: String? = null,
  val competitor: String? = null,
  val defense: String? = null,
  val date: String? = null,
)

@Serializable
data class Lead(
  val id: String,
  @SerialName("owner_id")
  val ownerId: String? = null,
  @SerialName("created_by")
  val createdBy: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
  val name: String,
  val phone: String? = null,
  val company: String? = null,
  val location: String? = null,
  val status: String? = null,
  @SerialName("loan_amount")
  val loanAmount: Long? = null,
  @SerialName("next_follow_up")
  val nextFollowUp: String? = null,
  @SerialName("mediator_id")
  val mediatorId: String? = null,
  @SerialName("is_high_potential")
  val isHighPotential: Boolean? = null,
  @SerialName("assigned_staff")
  val assignedStaff: String? = null,
  val documents: LeadDocuments? = null,
  val notes: List<LeadNote> = emptyList(),
  @SerialName("loan_details")
  val loanDetails: LoanDetails? = null,
  @SerialName("rejection_details")
  val rejectionDetails: RejectionDetails? = null,
)

@Serializable
data class LeadCreateInput(
  val name: String,
  val phone: String? = null,
  val company: String? = null,
  val location: String? = null,
  val status: String? = null,
  @SerialName("loan_amount")
  val loanAmount: Long? = null,
  @SerialName("next_follow_up")
  val nextFollowUp: String? = null,
  @SerialName("mediator_id")
  val mediatorId: String? = null,
  @SerialName("is_high_potential")
  val isHighPotential: Boolean? = null,
  @SerialName("assigned_staff")
  val assignedStaff: String? = null,
  val documents: LeadDocuments? = null,
  val notes: List<LeadNote>? = null,
  @SerialName("loan_details")
  val loanDetails: LoanDetails? = null,
  @SerialName("rejection_details")
  val rejectionDetails: RejectionDetails? = null,
)

@Serializable
data class LeadUpdate(
  val name: String? = null,
  val phone: String? = null,
  val company: String? = null,
  val location: String? = null,
  val status: String? = null,
  @SerialName("loan_amount")
  val loanAmount: Long? = null,
  @SerialName("next_follow_up")
  val nextFollowUp: String? = null,
  @SerialName("mediator_id")
  val mediatorId: String? = null,
  @SerialName("is_high_potential")
  val isHighPotential: Boolean? = null,
  @SerialName("assigned_staff")
  val assignedStaff: String? = null,
  val documents: LeadDocuments? = null,
  val notes: List<LeadNote>? = null,
  @SerialName("loan_details")
  val loanDetails: LoanDetails? = null,
  @SerialName("rejection_details")
  val rejectionDetails: RejectionDetails? = null,
  @SerialName("owner_id")
  val ownerId: String? = null,
)
