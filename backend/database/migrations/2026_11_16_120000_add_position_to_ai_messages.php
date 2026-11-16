<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ordre explicite des messages d'une conversation IA : l'horodatage (à la seconde)
 * ne suffit pas à distinguer une question de sa réponse enregistrées dans la même seconde.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_messages', function (Blueprint $table) {
            $table->unsignedInteger('position')->default(0)->after('ai_conversation_id');
            $table->index(['ai_conversation_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_messages', function (Blueprint $table) {
            $table->dropIndex(['ai_conversation_id', 'position']);
            $table->dropColumn('position');
        });
    }
};
