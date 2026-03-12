package com.privatefinance.app.data.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "communication_logs",
    foreignKeys = [
        ForeignKey(
            entity = ClientEntity::class,
            parentColumns = ["id"],
            childColumns = ["clientId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("clientId")]
)
data class CommunicationLogEntity(
    @PrimaryKey val id: String,
    val clientId: String,
    val type: String, // "CALL", "WHATSAPP", "VISIT"
    val notes: String?,
    val timestampEpochMs: Long
)
