% Constants
int: number_of_teams;
int: min_for_permanency_or_tour;
int: max_for_permanency_or_tour;
int: number_of_dates = (2*(number_of_teams-1));

set of int: teams_in_negative = -1*number_of_teams..-1;
set of int: teams = 1..number_of_teams;
set of int: dates = 1..number_of_dates;
set of int: calendar_values = teams_in_negative union teams;

array[teams,teams] of int: distance_per_team;


% Decision variables
array [dates, teams] of var calendar_values: calendar_of_matches;

% Constraints

% all local matches are match with a visitor match seems OK
constraint forall(date in dates, team in teams)( 
      if calendar_of_matches[date,team] > 0 then 
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team*-1 
      
      else
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team
     
      endif
);


% for all dates half the matches are local and half visitors seems OK 
constraint forall(date in dates)(
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == 
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams_in_negative)) /\
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == number_of_teams/2
);

% there has to be a match as local and as visitor seems OK 
constraint forall(team in teams)(
      forall(k in teams where k != team)(
            exists(date_one in dates, date_two in dates)(
              calendar_of_matches[date_one,team] == k /\ calendar_of_matches[date_two,team] == -1*k
            )
      )
);

% a tour is in the correct range
constraint forall(team in teams)(
    exists(first_date in dates,add in 0..number_of_dates-1 where first_date+add in dates)(
      forall(date in first_date..first_date+add)(
        calendar_of_matches[date,team] < 0 
      ) /\
      add+1 >= min_for_permanency_or_tour /\
      add+1 <= max_for_permanency_or_tour
    ) 
);

% in two consecutives dates there cannot be the same match seems ok
constraint forall(date in 1..number_of_dates-1, team in teams)( 
     abs(calendar_of_matches[date,team]) != abs(calendar_of_matches[date+1,team])
);


% Objective
var int: expenses; 

constraint expenses = sum(date in dates, team in teams)(
  if not (date+1 in dates) \/  date == 1 then
    if calendar_of_matches[date,team] < 0 then
      distance_per_team[abs(calendar_of_matches[date,team]),team]
      
    else
      distance_per_team[team,team] 
      
    endif
    
  elseif calendar_of_matches[date,team] > 0 /\ calendar_of_matches[date+1,team] < 0 then
    distance_per_team[abs(calendar_of_matches[date+1,team]),team]
    
  elseif calendar_of_matches[date,team] < 0 /\ calendar_of_matches[date,team] != calendar_of_matches[date+1,team] then
    distance_per_team[abs(calendar_of_matches[date+1,team]) ,abs(calendar_of_matches[date,team])] 
  
  else
    distance_per_team[team,team] 
  
  endif
);

solve minimize expenses;
         
output [ show(calendar_of_matches[i,j])++ "\t"++
         if j == number_of_teams then "\n" else " " endif |
         i in dates, j in teams
       ]++
       [
       show(expenses)
       ];
