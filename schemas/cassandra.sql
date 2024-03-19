create table e_vote.votes
(
    id          text primary key,
    election_id text,
    vote        text
);

create table e_vote.election_log
(
    id             text primary key,
    election_id    text,
    election_title text,
    log            text,
    log_creation   text,
    severity       text
);

create table e_vote.internal_log
(
    id           text primary key,
    log          text,
    log_creation text
);

create table e_vote.system_log
(
    id           text primary key,
    endpoint     text,
    log          text,
    log_creation text,
    method       text,
    stack        text
);

